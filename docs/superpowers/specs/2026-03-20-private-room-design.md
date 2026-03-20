# Private Room (4-Player) Design Spec

## Goal

로그인 없이 최대 4명이 같은 방에서 동시에 타이핑 레이스를 할 수 있는 기능.
링크 공유 → Ready → 방장 Start → 레이스 → 순위 결과.

## Architecture

WS 서버에 인메모리 Room Manager를 신규 추가. 기존 ranked 1v1 시스템과 완전히 분리.
방은 일시적 (게임 종료 후 자동 소멸) → DB 저장 불필요.
Railway 단일 인스턴스 환경에 적합.

## Data Structures

### Room (WS 서버 인메모리)

```ts
interface Room {
  id: string;                        // 6자리 대문자 코드 (e.g. "ABC123")
  hostId: string;                    // participantId of host
  phase: "lobby" | "countdown" | "racing" | "finished";
  promptId: string;
  promptText: string;
  players: Map<string, RoomPlayer>;  // participantId → player
  createdAt: number;
}

interface RoomPlayer {
  participantId: string;
  nickname: string;
  ws: WebSocket;
  ready: boolean;
  progress: number;   // 0~1
  wpm: number;
  rank: number | null;
  finishedAt: number | null;
}
```

### Room Expiry

방 생성 후 10분 내 레이스 미시작 시 자동 삭제. 레이스 종료 후 5분 뒤 삭제.

## WebSocket Messages

### Client → Server

| type | payload | 설명 |
|------|---------|------|
| `room.create` | — | 방 생성, 생성자가 방장 |
| `room.join` | `{ roomCode: string }` | 방 입장 |
| `room.ready` | `{ roomId: string }` | Ready 토글 |
| `room.start` | `{ roomId: string }` | 방장만 가능, 전원 Ready 상태 필요 |
| `race.input` | `{ roomId, seq, kind, value }` | 기존과 동일 구조, roomId 추가 |

### Server → Client

| type | payload | 설명 |
|------|---------|------|
| `room.created` | `{ roomId, roomCode }` | 방 생성 완료 |
| `room.joined` | `{ roomId, roomCode, promptText }` | 입장 완료 |
| `room.state` | `{ players, phase, hostId }` | 로비 상태 전체 브로드캐스트 |
| `room.countdown` | `{ serverStartAt }` | 카운트다운 시작 |
| `room.progress` | `{ players: [{id, progress, wpm}] }` | 레이스 중 실시간 진행도 |
| `room.finished` | `{ rankings: [{rank, nickname, wpm, progress, finishMs}] }` | 게임 종료 + 순위 |
| `error` | `{ code, message }` | ROOM_NOT_FOUND, ROOM_FULL, NOT_HOST 등 |

## User Flow

```
홈 화면
  └─ "Create Room" 클릭
       └─ POST /api/v1/guest-sessions (없으면) → 게스트 토큰 발급
       └─ WS 연결 + session.auth
       └─ room.create 전송
       └─ /room/ABC123 로 이동

/room/ABC123 접속 (친구)
  └─ WS 연결 + session.auth
  └─ room.join { roomCode: "ABC123" }
  └─ 로비 화면 진입

로비
  └─ 플레이어 목록 + Ready 버튼
  └─ 방 코드 + 링크 복사 버튼
  └─ 전원 Ready → 방장에게 Start 버튼 활성화
  └─ 방장 Start 클릭 → room.start

레이스
  └─ 내 화면 좌측 크게 (프롬프트 + 커서)
  └─ 우측에 상대방 패널 세로 나열 (닉네임 + 게이지 + 미니 텍스트)
  └─ 1등 완주 순간 서버가 room.finished 브로드캐스트

결과
  └─ 순위 + WPM + 정확도 테이블
  └─ "Play Again" (같은 방으로 로비 복귀) / "Leave"
```

## Frontend Structure

```
app/
  room/
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
    room-manager.ts         — Map<roomId, Room>, 생성/조회/삭제/만료 처리
    room-handler.ts         — room.create / room.join / room.ready / room.start
    room-race.ts            — race.input (방 전용), 진행도 브로드캐스트, 1등 감지
  router.ts                 — 신규 메시지 타입 라우팅 추가
```

## Race Screen Layout

```
┌─────────────────────────────────────────────────────┐
│  [내 닉네임]              WPM / Accuracy             │
│  ████████████████░░░░░░░ (내 progress bar)           │
│  ┌─────────────────────────────────────────────┐    │
│  │ The quick brown fox jumps over the lazy...  │    │  ← 내 프롬프트 (크게)
│  │ [커서 위치 표시]                              │    │
│  └─────────────────────────────────────────────┘    │
│                                      │               │
│  ┌──────────────────────┐  상대1     │               │
│  │ Player2   45 WPM     │  ████░░░░  │  ← 상대 패널  │
│  │ quick brown fox...   │            │               │
│  ├──────────────────────┤  상대2     │               │
│  │ Player3   38 WPM     │  ███░░░░░  │               │
│  └──────────────────────┘            │               │
└─────────────────────────────────────────────────────┘
```

## Edge Cases

| 상황 | 처리 |
|------|------|
| 방장 퇴장 | 다음 입장 순서 플레이어 방장 승계, room.state 브로드캐스트 |
| 레이스 중 퇴장 | DNF 처리 (progress 고정), 나머지 계속 진행 |
| 4명 꽉 찬 방 입장 | ROOM_FULL 에러 |
| 잘못된 방 코드 | ROOM_NOT_FOUND 에러 |
| 방장 아닌 사람이 start | NOT_HOST 에러 |
| 10분 내 미시작 | 방 자동 삭제 |

## Shared Types (packages/shared)

`ServerEvent` union에 추가:
- `RoomCreatedEvent`, `RoomJoinedEvent`, `RoomStateEvent`
- `RoomCountdownEvent`, `RoomProgressEvent`, `RoomFinishedEvent`

`ClientEvent` union에 추가:
- `RoomCreateEvent`, `RoomJoinEvent`, `RoomReadyEvent`, `RoomStartEvent`
