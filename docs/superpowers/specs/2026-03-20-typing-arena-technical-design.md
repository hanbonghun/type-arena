# Typing Arena 기술 설계서

- 작성일: 2026-03-20
- 기반 문서: `2026-03-19-typing-arena-mvp-design.md`
- 목적: MVP 구현을 위한 기술스택, 아키텍처, 프로젝트 구조 확정

## 1. 기술스택

### 1.1 언어 및 런타임

| 항목 | 선택 | 버전 |
|---|---|---|
| 언어 | TypeScript | 5.x |
| 런타임 | Node.js | 20 LTS |
| 패키지 매니저 | pnpm | 9.x |
| 모노레포 도구 | Turborepo | latest |

### 1.2 Frontend

| 항목 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) | SSR/SSG + SPA 혼합, Claude Code 생성 최적 |
| 스타일링 | Tailwind CSS 4 | 유틸리티 기반, 빠른 UI 구축 |
| 상태관리 | Zustand | 경량, 보일러플레이트 최소 |
| 인증 | NextAuth.js v5 | Google OAuth 즉시 통합 |
| 애니메이션 | Framer Motion | 카운트다운, 진행바 |
| WebSocket 클라이언트 | 네이티브 WebSocket 래퍼 | 경량, 커스텀 재연결 로직 필요 |

### 1.3 Backend (WebSocket 서버)

| 항목 | 선택 | 이유 |
|---|---|---|
| WebSocket | ws | 안정적, 널리 사용됨, Node.js 네이티브 |
| HTTP (헬스체크용) | Fastify | ws서버 내 헬스체크/메트릭 엔드포인트 |
| Redis 클라이언트 | ioredis | 풍부한 기능, Pub/Sub 지원 |
| 작업 큐 | BullMQ | Redis 기반 백그라운드 워커 |
| 스키마 검증 | zod (shared 패키지) | FE/BE 타입 공유 |

### 1.4 Data

| 항목 | 선택 | 이유 |
|---|---|---|
| RDB | PostgreSQL 16 | 기능정의서 요구사항 |
| ORM | Prisma | 스키마 → 타입 + 마이그레이션 자동 생성 |
| 캐시/실시간 상태 | Redis 7 | 큐 티켓, 매치 상태, 세션, rate limit |

### 1.5 인프라/배포

| 항목 | 선택 | 이유 |
|---|---|---|
| 프론트엔드 배포 | Vercel | Next.js 최적화, 무료 티어, 글로벌 CDN |
| WS 서버 배포 | Railway | 상시 프로세스, WebSocket 지원, $5/월~ |
| DB 호스팅 | Railway (PostgreSQL) | WS 서버와 같은 네트워크 |
| Redis 호스팅 | Railway (Redis) | WS 서버와 같은 네트워크 |
| 로컬 개발 | Docker Compose | PostgreSQL + Redis 로컬 실행 |

## 2. 아키텍처

### 2.1 전체 구조

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser    │ ◄────────────► │   Vercel (Next.js)│
│   (SPA)      │                │   - SSR 페이지     │
│              │                │   - REST API Routes│
└──────┬───────┘                └────────┬─────────┘
       │                                 │
       │ WSS                             │ DB 직접 접근
       │                                 │ (Prisma)
       ▼                                 ▼
┌──────────────┐  ioredis    ┌─────────────────┐
│  Railway     │ ◄──────────►│  Railway         │
│  WS Server   │             │  PostgreSQL      │
│  - 매치 엔진  │             └─────────────────┘
│  - 큐 관리    │  ioredis    ┌─────────────────┐
│  - 실시간 판정│ ◄──────────►│  Railway         │
└──────────────┘             │  Redis           │
                             └─────────────────┘
```

### 2.2 역할 분리

| 계층 | 담당 |
|---|---|
| **Next.js API Routes** | 인증, 프로필 CRUD, 매치 이력 조회, 리더보드, 관리자 API, 프롬프트 관리 |
| **WS Server** | WebSocket 세션, 매치메이킹 큐, 방 관리, 실시간 경기 엔진, 입력 판정, RS 계산 |
| **PostgreSQL** | 유저, 매치 결과, RS, 프롬프트, 방, 시즌 등 영속 데이터 |
| **Redis** | 큐 티켓, 라이브 매치 상태, 방 상태 스냅샷, reconnect 토큰, rate limit |
| **BullMQ Worker** | 리더보드 갱신, 만료 방 정리, 매치 이벤트 로그 정리 |

### 2.3 인증 흐름

```
Browser → Next.js (NextAuth.js) → Google OAuth → 세션 쿠키 발급
Browser → WS 연결 시 → 세션 쿠키 또는 게스트 토큰 전송 → WS 서버가 검증
```

- NextAuth.js가 세션을 관리하고, JWT 또는 세션 ID를 쿠키에 저장
- WS 서버는 연결 시 쿠키를 파싱하여 사용자를 식별
- 게스트는 `/v1/guest-sessions` → 임시 토큰 발급 → WS 연결 시 토큰 사용

### 2.4 실시간 매치 데이터 흐름

```
1. 클라이언트 키 입력 → 로컬 즉시 렌더링 (optimistic)
2. race.input 이벤트 → WS 서버
3. WS 서버: 프롬프트 기반 판정 → 공식 progress 계산
4. race.progress 이벤트 → 양측 클라이언트
5. 클라이언트: 서버 progress와 로컬 불일치 시 보정
6. 완료/타임아웃 → race.result 이벤트 + DB 저장
```

## 3. 프로젝트 구조

```
type-arena/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                      # Turborepo 설정
├── docker-compose.yml              # 로컬 Postgres + Redis
├── .env.example                    # 환경변수 템플릿
├── packages/
│   └── shared/                     # FE/BE 공유 패키지
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── schemas/
│           │   ├── ws-events.ts    # WebSocket 이벤트 zod 스키마
│           │   ├── api.ts          # REST API 요청/응답 스키마
│           │   └── game.ts         # 게임 도메인 타입
│           ├── constants/
│           │   ├── game-rules.ts   # 120초, K값, 티어 범위 등
│           │   └── match-states.ts # 상태 전이 정의
│           └── utils/
│               ├── rating.ts       # Elo RS 계산 순수 함수
│               └── stats.ts        # WPM, accuracy 계산 순수 함수
├── apps/
│   ├── web/                        # Next.js 15 프론트엔드
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── app/
│   │   │   ├── layout.tsx          # 루트 레이아웃
│   │   │   ├── page.tsx            # SCR-01 Home / Mode Select
│   │   │   ├── auth/
│   │   │   │   └── page.tsx        # SCR-02 Auth + Beta Access
│   │   │   ├── ranked/
│   │   │   │   └── page.tsx        # SCR-03 Ranked Queue
│   │   │   ├── room/
│   │   │   │   └── [code]/
│   │   │   │       └── page.tsx    # SCR-04 Private Room Lobby
│   │   │   ├── match/
│   │   │   │   └── [id]/
│   │   │   │       ├── race/
│   │   │   │       │   └── page.tsx # SCR-05 Race Screen
│   │   │   │       ├── result/
│   │   │   │       │   └── page.tsx # SCR-06 Results Screen
│   │   │   │       └── page.tsx    # SCR-08 Match Detail
│   │   │   ├── profile/
│   │   │   │   └── page.tsx        # SCR-07 Profile / Match History
│   │   │   ├── leaderboard/
│   │   │   │   └── page.tsx        # SCR-09 Leaderboard
│   │   │   └── api/
│   │   │       └── v1/
│   │   │           ├── guest-sessions/
│   │   │           │   └── route.ts
│   │   │           ├── auth/
│   │   │           │   └── [...nextauth]/
│   │   │           │       └── route.ts
│   │   │           ├── me/
│   │   │           │   ├── route.ts
│   │   │           │   ├── profile/
│   │   │           │   │   └── route.ts
│   │   │           │   └── matches/
│   │   │           │       └── route.ts
│   │   │           ├── practice-matches/
│   │   │           │   └── route.ts
│   │   │           ├── matches/
│   │   │           │   └── [matchId]/
│   │   │           │       ├── route.ts
│   │   │           │       └── report/
│   │   │           │           └── route.ts
│   │   │           ├── rooms/
│   │   │           │   ├── route.ts
│   │   │           │   └── [inviteCode]/
│   │   │           │       ├── route.ts
│   │   │           │       ├── join/route.ts
│   │   │           │       ├── ready/route.ts
│   │   │           │       ├── start/route.ts
│   │   │           │       ├── leave/route.ts
│   │   │           │       └── rematch/route.ts
│   │   │           └── leaderboard/
│   │   │               └── current/
│   │   │                   └── route.ts
│   │   ├── lib/
│   │   │   ├── prisma.ts           # Prisma 클라이언트 싱글턴
│   │   │   ├── ws-client.ts        # WebSocket 클라이언트 래퍼
│   │   │   ├── auth.ts             # NextAuth 설정
│   │   │   └── stores/
│   │   │       ├── auth-store.ts   # 인증 상태
│   │   │       ├── race-store.ts   # 레이스 진행 상태
│   │   │       ├── room-store.ts   # 방 상태
│   │   │       └── queue-store.ts  # 큐 상태
│   │   └── components/
│   │       ├── ui/                 # 공통 UI (버튼, 카드, 배지 등)
│   │       ├── layout/             # 네비게이션, 헤더
│   │       ├── race/               # 레이스 HUD 컴포넌트
│   │       │   ├── prompt-display.tsx
│   │       │   ├── typing-input.tsx
│   │       │   ├── progress-bar.tsx
│   │       │   ├── countdown.tsx
│   │       │   └── live-stats.tsx
│   │       ├── room/               # 로비 컴포넌트
│   │       └── result/             # 결과 화면 컴포넌트
│   └── ws-server/                  # 독립 WebSocket 서버
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile              # Railway 배포용
│       └── src/
│           ├── index.ts            # 진입점: HTTP + WS 서버 시작
│           ├── config.ts           # 환경변수 로딩
│           ├── handlers/
│           │   ├── session.ts      # session.auth, ping/pong
│           │   ├── queue.ts        # queue.join/leave
│           │   ├── room.ts         # room.subscribe/ready/start
│           │   └── race.ts         # match.loaded, race.input/leave
│           ├── engine/
│           │   ├── match-state.ts  # 상태 전이 머신 (기능정의서 12.2절)
│           │   ├── input-judge.ts  # 서버 입력 판정 (기능정의서 5.2절)
│           │   ├── matchmaker.ts   # Elo 기반 매칭 (기능정의서 6.4절)
│           │   └── rating.ts       # RS 계산 (shared/utils 호출)
│           ├── services/
│           │   ├── redis.ts        # Redis 연결/유틸
│           │   ├── db.ts           # Prisma 클라이언트
│           │   └── prompt.ts       # 프롬프트 로딩/캐싱
│           ├── middleware/
│           │   ├── auth.ts         # WS 연결 시 세션 검증
│           │   └── rate-limit.ts   # 입력 속도 제한
│           └── workers/
│               ├── leaderboard.ts  # 리더보드 갱신
│               ├── room-cleanup.ts # 만료 방 정리
│               └── log-cleanup.ts  # 이벤트 로그 7일 보관
├── prisma/
│   ├── schema.prisma               # DB 스키마 (기능정의서 14장)
│   ├── seed.ts                     # 시드 데이터 (프롬프트, Season 0)
│   └── migrations/                 # 자동 생성
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-20-typing-arena-technical-design.md
```

## 4. DB 스키마 (Prisma)

기능정의서 14장 데이터 모델을 Prisma 스키마로 변환한 설계:

```prisma
// 핵심 테이블만 명시. 인덱스, enum 등은 구현 시 확정.

model UserAccount {
  id          String   @id @default(cuid())
  googleSub   String?  @unique
  displayName String
  email       String?  @unique
  status      String   @default("active") // active, suspended, banned
  betaAccess  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GuestSession {
  id              String   @id @default(cuid())
  nickname        String
  fingerprintHash String?
  expiresAt       DateTime
  createdAt       DateTime @default(now())
}

model BetaInvite {
  code      String   @id
  status    String   @default("active") // active, exhausted, disabled
  maxUses   Int      @default(1)
  usedCount Int      @default(0)
  expiresAt DateTime?
  createdAt DateTime @default(now())
}

model PromptCatalog {
  id             String  @id @default(cuid())
  language       String  @default("en")
  text           String
  normalizedText String
  checksum       String
  difficulty     String  @default("standard")
  active         Boolean @default(true)
  createdAt      DateTime @default(now())
}

model PrivateRoom {
  id         String   @id @default(cuid())
  inviteCode String   @unique
  status     String   @default("open") // open, in_match, closed, expired
  hostUserId String
  createdAt  DateTime @default(now())
  expiresAt  DateTime
}

model RoomParticipant {
  id              String   @id @default(cuid())
  roomId          String
  participantType String   // user, guest
  participantId   String
  slot            Int      // 0 or 1
  readyState      Boolean  @default(false)
  joinedAt        DateTime @default(now())

  @@unique([roomId, slot])
}

model Match {
  id                   String    @id @default(cuid())
  mode                 String    // ranked, private, practice
  region               String?
  promptId             String
  state                String    // loading, countdown, racing, completed, aborted, forfeit
  serverStartAt        DateTime?
  startedAt            DateTime?
  endedAt              DateTime?
  winnerParticipantId  String?
  outcomeType          String?   // completion, timeout, forfeit, draw, no_result
  createdAt            DateTime  @default(now())
}

model MatchParticipant {
  id              String  @id @default(cuid())
  matchId         String
  participantType String  // user, guest
  participantId   String
  slot            Int
  finishMs        Int?
  correctChars    Int     @default(0)
  totalKeystrokes Int     @default(0)
  accuracy        Float?
  wpm             Float?
  ratingBefore    Int?
  ratingAfter     Int?
  forfeitReason   String?

  @@unique([matchId, slot])
}

model MatchEventLog {
  id        String   @id @default(cuid())
  matchId   String   @unique
  timeline  Json     // 전체 입력 이벤트 타임라인
  createdAt DateTime @default(now())
}

model SeasonRating {
  id          String  @id @default(cuid())
  seasonId    String
  userId      String
  rs          Int     @default(1000)
  rankedGames Int     @default(0)
  wins        Int     @default(0)
  losses      Int     @default(0)
  draws       Int     @default(0)
  provisional Boolean @default(true)

  @@unique([seasonId, userId])
}

model Season {
  id        String   @id @default(cuid())
  name      String   // "Season 0"
  status    String   @default("active") // active, ended
  startedAt DateTime @default(now())
  endedAt   DateTime?
}

model AbuseReport {
  id         String   @id @default(cuid())
  matchId    String
  reporterId String
  reason     String
  createdAt  DateTime @default(now())
}
```

## 5. Redis 상태 설계

| Key 패턴 | 타입 | 용도 | TTL |
|---|---|---|---|
| `queue:ranked:{region}` | Sorted Set (score=RS) | 매칭 대기열 | 회원별 60초 |
| `queue:ticket:{userId}` | Hash | 큐 티켓 상세 | 120초 |
| `match:live:{matchId}` | Hash | 진행 중 매치 상태 | 300초 |
| `match:live:{matchId}:p{slot}` | Hash | 플레이어별 progress | 300초 |
| `room:state:{inviteCode}` | Hash | 방 상태 스냅샷 | 30분 |
| `reconnect:{matchId}:{userId}` | String (token) | 재연결 토큰 | 10초 |
| `session:ws:{connectionId}` | Hash | WS 세션 정보 | 연결 유지 중 |
| `ratelimit:{ip}:{endpoint}` | String (count) | Rate limit 카운터 | 윈도우별 |
| `guest:{guestId}` | Hash | 게스트 세션 캐시 | 24시간 |

## 6. 환경변수 설계

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/type_arena

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# WebSocket Server
WS_PORT=8080
WS_CORS_ORIGIN=http://localhost:3000

# Shared
NODE_ENV=development
```

## 7. 구현 Phase 계획

기능정의서 17장의 개발 순서를 기술스택에 맞춰 재정의:

### Phase 1: 프로젝트 기반 + 솔로 연습 (목표: 첫 타이핑 가능)

1. 모노레포 스캐폴딩 (pnpm, Turborepo, tsconfig)
2. shared 패키지: 게임 상수, 기본 타입, 계산 유틸
3. Prisma 스키마 + Docker Compose + 마이그레이션
4. Next.js 기본 설정 (Tailwind, NextAuth, 레이아웃)
5. 게스트 세션 API
6. 프롬프트 카탈로그 API + 시드 데이터
7. SCR-01 Home 화면
8. SCR-05 Race Screen (솔로 연습 모드, 서버 없이 로컬 판정)
9. SCR-06 Results Screen (솔로 연습 결과)
10. 솔로 연습 플로우 완성 (Home → Race → Result → Home)

### Phase 2: 실시간 엔진 (목표: 1v1 대결 가능)

1. WS 서버 스캐폴딩 (ws, Fastify 헬스체크)
2. WS 세션 인증 (session.auth)
3. shared: WebSocket 이벤트 스키마 전체 정의
4. WS 클라이언트 래퍼 (재연결, 이벤트 디스패치)
5. 매치 상태 전이 머신 구현
6. 서버 입력 판정 엔진 (input-judge)
7. Race Screen을 WS 기반으로 전환
8. 상대 progress 표시
9. 경기 완료/타임아웃 판정
10. Results Screen WS 이벤트 연동

### Phase 3: 비공개 방 (목표: 친구와 대결 가능)

1. 방 생성/참가 REST API
2. 방 상태 Redis 관리
3. WS room 이벤트 핸들러
4. SCR-04 Private Room Lobby
5. Ready/Start 플로우
6. Rematch 플로우
7. Host 이탈/방 만료 처리
8. reconnect/forfeit 처리

### Phase 4: 랭크전 (목표: 경쟁 시스템 완성)

1. Google OAuth 로그인 연동
2. SCR-02 Auth + Beta Access
3. 베타 초대코드 검증
4. 매치메이킹 큐 (Redis Sorted Set)
5. SCR-03 Ranked Queue
6. RS 계산 + SeasonRating 저장
7. SCR-07 Profile / Match History
8. SCR-08 Match Detail
9. SCR-09 Leaderboard
10. BullMQ 워커 (리더보드 갱신, 방 정리)

### Phase 5: 배포 및 안정화 (목표: 클로즈드 베타 런칭)

1. Vercel 배포 설정
2. Railway 배포 (WS서버 + Postgres + Redis)
3. 환경변수 설정
4. HTTPS/WSS 설정
5. 관리자 최소 기능 API
6. rate limit 적용
7. 구조화 로그 + 메트릭
8. 오류 상태 UX 정리
9. E2E 테스트 주요 플로우
10. 클로즈드 베타 런칭

## 8. 핵심 설계 결정 요약

| 결정 | 근거 |
|---|---|
| Full TypeScript 모노레포 | FE/BE 타입 공유로 30개+ WS 이벤트 계약 불일치 방지 |
| Next.js API Routes로 REST 처리 | Vercel 무료 배포, 별도 REST 서버 불필요 |
| WS 서버 분리 | 상시 연결 프로세스는 서버리스와 맞지 않음 |
| Prisma | 스키마 → 타입 자동 생성, 마이그레이션 관리 |
| Zustand | Redux 대비 보일러플레이트 1/5, 실시간 상태에 적합 |
| Redis Sorted Set 매칭 | RS 기반 범위 매칭에 최적화된 자료구조 |
| 솔로 연습부터 구현 | 가장 빠르게 동작하는 결과물, 이후 WS 전환 용이 |
