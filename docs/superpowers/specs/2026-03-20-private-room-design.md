# Private Room (4-Player) Design Spec

## Goal

로그인 없이 최대 4명이 같은 방에서 동시에 타이핑 레이스를 할 수 있는 기능.
링크 공유 → Ready → 방장 Start → 레이스 → 1등 완주 시 종료 → 순위 결과.

## Architecture

WS 서버에 인메모리 Room Manager를 신규 추가. 기존 ranked 1v1 시스템과 완전히 분리.
방은 일시적 (게임 종료 후 자동 소멸) → DB 저장 불필요.
Railway 단일 인스턴스 환경 전용 (수평 확장 필요 시 Redis로 마이그레이션 필요).

## Data Structures

### Room (WS 서버 인메모리)

```ts
interface Room {
  id: string;                        // 6자리 대문자+숫자 코드 (e.g. "ABC123")
  hostId: string;                    // participantId of host (lobby 단계에서만 변경)
  phase: "lobby" | "countdown" | "racing" | "finished";
  promptId: string;
  promptText: string;
  players: Map<string, RoomPlayer>;  // participantId → player
  createdAt: number;
  startedAt: number | null;
}

interface RoomPlayer {
  participantId: string;
  nickname: string;
  ws: WebSocket;
  ready: boolean;
  progress: number;    // 0~1
  wpm: number;
  accuracy: number;
  rank: number | null;
  finishedAt: number | null;
}
```

### Room Code

- 6자리 대문자+숫자 랜덤 생성
- 충돌 시 최대 5회 재시도 후 실패 응답

### Room Expiry

- 방 생성 후 10분 내 미시작 → 자동 삭제
- 레이스 종료 후 5분 뒤 삭제
- 레이스 중 타임아웃 120초 (MATCH_TIMEOUT_MS) 도달 → 강제 종료, room.finished 브로드캐스트

## WebSocket Messages

### Client → Server

| type | payload | 설명 |
|------|---------|------|
| `room.create` | — | 방 생성, 생성자가 방장 |
| `room.join` | `{ roomCode: string }` | 방 입장 |
| `room.ready` | `{ roomId: string }` | Ready 토글 |
| `room.start` | `{ roomId: string }` | 방장만 가능, 전원 Ready 상태 필요 |
| `race.input` | `{ roomId, seq, kind, value }` | 기존과 동일, roomId 추가 |

### Server → Client

| type | payload | 설명 |
|------|---------|------|
| `room.created` | `{ roomId, roomCode, promptText }` | 방 생성 완료 (promptText 포함) |
| `room.joined` | `{ roomId, roomCode, promptText, players, hostId }` | 입장 완료 |
| `room.state` | `{ roomId, phase, hostId, players: RoomPlayerPublic[] }` | 로비 상태 전체 브로드캐스트 |
| `room.countdown` | `{ serverStartAt }` | 카운트다운 시작 (loading 단계 없음) |
| `room.progress` | `{ players: [{id, progress, wpm, accuracy}] }` | 레이스 실시간 진행도 (전체 브로드캐스트) |
| `room.finished` | `{ rankings: RoomRanking[] }` | 게임 종료 + 순위 |
| `error` | `{ code, message }` | ROOM_NOT_FOUND, ROOM_FULL, NOT_HOST 등 |

```ts
interface RoomPlayerPublic {
  participantId: string;
  nickname: string;
  ready: boolean;
  isHost: boolean;
}

interface RoomRanking {
  rank: number;
  participantId: string;
  nickname: string;
  wpm: number;
  accuracy: number;
  progress: number;   // 0~1
  finishMs: number | null;
}
```

### 순위 결정 규칙

1. 완주자: finishMs 빠른 순
2. 미완주자: 1등 완주 시점의 progress 높은 순
3. 동일 progress: wpm 높은 순

## User Flow

```
홈 화면
  └─ "Create Room" 클릭
       └─ 기존 게스트 세션 재사용 또는 POST /api/v1/guest-sessions
       └─ localStorage에 guest token 저장
       └─ /room/new → 서버에서 방 생성 후 /room/ABC123 리다이렉트

/room/ABC123 접속 (친구)
  └─ WS 연결 + session.auth (게스트 토큰 사용)
  └─ room.join { roomCode: "ABC123" }
  └─ 로비 화면 진입

로비
  └─ 플레이어 목록 (닉네임 + Ready 상태)
  └─ 방 코드 + 링크 복사 버튼
  └─ Ready 버튼 (토글)
  └─ 전원 Ready → 방장에게 Start 버튼 활성화
  └─ 방장 Start 클릭 → room.start → room.countdown 브로드캐스트

레이스
  └─ 카운트다운 → GO! → 타이핑 시작
  └─ 내 화면 좌측 크게 (프롬프트 + 커서)
  └─ 우측에 상대방 패널 세로 나열 (닉네임 + 게이지 + 미니 텍스트 + WPM)
  └─ 1등 완주 → 서버 즉시 room.finished 브로드캐스트 → 모든 플레이어 입력 중지

결과
  └─ 순위 테이블 (순위 / 닉네임 / WPM / 정확도 / 완주시간)
  └─ "Play Again" → 로비 복귀 (ready 상태 초기화, 새 프롬프트)
  └─ "Leave" → 홈으로
```

## Authentication

- 게스트 세션 재사용: `localStorage["type_arena_guest"]` 유효하면 재사용
- 없으면 새로 생성: `POST /api/v1/guest-sessions`
- 게스트 JWT로 WS 인증 (기존 WS 서버 `type: "guest"` 이미 지원)
- Google 로그인 유저도 동일하게 참여 가능

## Frontend Structure

```
app/
  room/
    new/
      page.tsx              — 방 생성 처리 후 /room/[code]로 리다이렉트
    [code]/
      page.tsx              — 단일 페이지, phase별 UI 전환 (lobby/race/result)

lib/stores/
  room-store.ts             — WS 연결, 방 상태, 레이스 상태 통합 관리

components/room/
  lobby-view.tsx            — 플레이어 목록, Ready 버튼, 코드 공유
  room-race-view.tsx        — 레이스 레이아웃 (내 화면 + 상대방 패널들)
  room-result-view.tsx      — 최종 순위 테이블
```

## WS Server Structure

```
apps/ws-server/src/
  rooms/
    room-manager.ts         — Map<roomId, Room>, 생성/조회/삭제/만료/코드 충돌 처리
    room-handler.ts         — room.create / room.join / room.ready / room.start
    room-race.ts            — race.input (방 전용), 진행도 브로드캐스트, 1등 감지, 타임아웃
  router.ts                 — 신규 메시지 타입 라우팅 추가
```

## Race Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│ 좌측 (flex-1): 내 화면                                    │
│  [내 닉네임]  You          WPM 72 · 98.5%                 │
│  ████████████████░░░░░░░ progress bar                     │
│  ┌───────────────────────────────────────────────────┐   │
│  │ The quick brown fox jumps over the lazy dog...    │   │
│  │ [커서 위치 표시]                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│ 우측 (w-72): 상대방 패널 (최대 3개 세로 나열)              │
│  ┌────────────────────────────────┐                       │
│  │ Player2          45 WPM        │                       │
│  │ ██████░░░░░░░░░░ 40%           │                       │
│  │ quick brown fox...             │  ← 미니 텍스트 커서   │
│  ├────────────────────────────────┤                       │
│  │ Player3          38 WPM        │                       │
│  │ ████░░░░░░░░░░░░ 28%           │                       │
│  │ quick brown...                 │                       │
│  ├────────────────────────────────┤                       │
│  │ Player4          51 WPM        │                       │
│  │ ████████░░░░░░░░ 55%           │                       │
│  │ quick brown fox jumps...       │                       │
│  └────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## Edge Cases

| 상황 | 처리 |
|------|------|
| 방장 퇴장 (lobby) | 다음 입장 순서 플레이어 방장 승계, room.state 브로드캐스트 |
| 방장 퇴장 (racing) | 방장 승계 없음 (레이스 계속), DNF 처리 |
| 레이스 중 퇴장 | DNF 처리 (진행도 고정), 나머지 계속 진행 |
| 4명 꽉 찬 방 입장 | ROOM_FULL 에러 |
| 잘못된 방 코드 | ROOM_NOT_FOUND 에러 |
| 방장 아닌 사람이 start | NOT_HOST 에러 |
| 레이스 미시작 상태에서 10분 경과 | 방 자동 삭제 |
| 레이스 중 120초 타임아웃 | room.finished 강제 브로드캐스트 |
| Play Again | ready 초기화, 새 프롬프트 랜덤 선택 |
| 방 코드 충돌 | 최대 5회 재생성 시도 |

## Shared Types (packages/shared)

`ServerEvent` union에 추가:
- `RoomCreatedEvent`, `RoomJoinedEvent`, `RoomStateEvent`
- `RoomCountdownEvent`, `RoomProgressEvent`, `RoomFinishedEvent`

`ClientEvent` union에 추가:
- `RoomCreateEvent`, `RoomJoinEvent`, `RoomReadyEvent`, `RoomStartEvent`
