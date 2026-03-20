# Phase 1: 프로젝트 기반 + 솔로 연습 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 방문자가 2클릭 내로 솔로 타이핑 연습을 시작하고, 결과를 확인하고, 다시 시도할 수 있는 완전한 플로우를 구현한다.

**Architecture:** pnpm + Turborepo 모노레포 위에 shared 패키지(게임 상수/타입/유틸), Next.js 15 App Router 프론트엔드, Prisma + PostgreSQL을 구성한다. Phase 1에서는 WS 서버 없이 브라우저 로컬에서 입력 판정을 수행하며, Phase 2에서 서버 권위 모델로 전환한다.

**Tech Stack:** TypeScript 5, Node.js 20, pnpm 9, Turborepo, Next.js 15, Tailwind CSS 4, Zustand, Prisma, PostgreSQL 16, Docker Compose, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-typing-arena-technical-design.md`
**Requirements:** `2026-03-19-typing-arena-mvp-design.md`

---

## File Map

### New Files Created in Phase 1

```
type-arena/
├── package.json                          # Task 1
├── pnpm-workspace.yaml                   # Task 1
├── turbo.json                            # Task 1
├── tsconfig.base.json                    # Task 1
├── docker-compose.yml                    # Task 3
├── .env.example                          # Task 3
├── .env                                  # Task 3 (gitignored)
├── .gitignore                            # Task 1
├── packages/
│   └── shared/
│       ├── package.json                  # Task 2
│       ├── tsconfig.json                 # Task 2
│       ├── vitest.config.ts              # Task 2
│       └── src/
│           ├── index.ts                  # Task 2
│           ├── constants/
│           │   └── game-rules.ts         # Task 2
│           ├── schemas/
│           │   └── game.ts               # Task 2
│           └── utils/
│               ├── stats.ts              # Task 2
│               ├── stats.test.ts         # Task 2
│               ├── rating.ts             # Task 2
│               └── rating.test.ts        # Task 2
├── prisma/
│   ├── schema.prisma                     # Task 3
│   └── seed.ts                           # Task 5
├── apps/
│   └── web/
│       ├── package.json                  # Task 4
│       ├── tsconfig.json                 # Task 4
│       ├── next.config.ts                # Task 4
│       ├── postcss.config.mjs            # Task 4
│       ├── app/
│       │   ├── globals.css               # Task 4
│       │   ├── layout.tsx                # Task 4
│       │   ├── page.tsx                  # Task 7
│       │   ├── practice/
│       │   │   └── page.tsx              # Task 8
│       │   └── practice/
│       │       └── result/
│       │           └── page.tsx           # Task 9
│       ├── app/api/v1/
│       │   ├── guest-sessions/
│       │   │   └── route.ts              # Task 6
│       │   └── practice-matches/
│       │       └── route.ts              # Task 8
│       ├── lib/
│       │   ├── prisma.ts                 # Task 4
│       │   └── stores/
│       │       └── race-store.ts         # Task 8
│       └── components/
│           ├── ui/
│           │   └── button.tsx            # Task 7
│           └── race/
│               ├── prompt-display.tsx    # Task 8
│               ├── typing-input.tsx      # Task 8
│               ├── progress-bar.tsx      # Task 8
│               ├── countdown.tsx         # Task 8
│               └── live-stats.tsx        # Task 8
```

---

## Task 1: 모노레포 스캐폴딩

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Step 1: root package.json 작성**

```json
{
  "name": "type-arena",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:push": "pnpm --filter @type-arena/web exec prisma db push",
    "db:seed": "pnpm --filter @type-arena/web exec prisma db seed",
    "db:studio": "pnpm --filter @type-arena/web exec prisma studio"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: pnpm-workspace.yaml 작성**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: turbo.json 작성**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: tsconfig.base.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: .gitignore 작성**

```
node_modules/
.next/
dist/
.turbo/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 6: pnpm install 실행 확인**

Run: `pnpm install`
Expected: lockfile 생성, turbo 설치 완료

- [ ] **Step 7: 커밋**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "모노레포 스캐폴딩: pnpm workspace + Turborepo 설정"
```

---

## Task 2: shared 패키지 — 게임 상수, 타입, 계산 유틸

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants/game-rules.ts`
- Create: `packages/shared/src/schemas/game.ts`
- Create: `packages/shared/src/utils/stats.ts`
- Create: `packages/shared/src/utils/stats.test.ts`
- Create: `packages/shared/src/utils/rating.ts`
- Create: `packages/shared/src/utils/rating.test.ts`

- [ ] **Step 1: shared package.json 작성**

```json
{
  "name": "@type-arena/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3",
    "typescript": "^5.7"
  },
  "dependencies": {
    "zod": "^3.24"
  }
}
```

- [ ] **Step 2: shared tsconfig.json 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: vitest.config.ts 작성**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: game-rules.ts 작성 — 게임 상수 정의**

기능정의서 5장, 6장의 모든 숫자를 상수로 추출한다.

```ts
// packages/shared/src/constants/game-rules.ts

/** 경기 최대 시간 (ms) */
export const MATCH_TIMEOUT_MS = 120_000;

/** 카운트다운 시간 (ms) */
export const COUNTDOWN_MS = 3_000;

/** 클라이언트 로딩 대기 시간 (ms) */
export const LOADING_TIMEOUT_MS = 10_000;

/** 연결 끊김 재연결 유예 시간 (ms) */
export const RECONNECT_GRACE_MS = 10_000;

/** 무응답 패배 처리 시간 (ms) — 경기 시작 후 30초간 정확한 입력 0개 */
export const INACTIVITY_FORFEIT_MS = 30_000;

/** 방 무활동 만료 시간 (ms) */
export const ROOM_EXPIRE_MS = 30 * 60 * 1000;

/** 초기 RS */
export const INITIAL_RS = 1000;

/** Provisional 경기 수 */
export const PROVISIONAL_GAMES = 10;

/** Elo K값: provisional */
export const K_PROVISIONAL = 48;

/** Elo K값: 일반 */
export const K_NORMAL = 32;

/** 매칭 큐 타임아웃 (ms) */
export const QUEUE_TIMEOUT_MS = 60_000;

/** 프롬프트 권장 길이 (단어) */
export const PROMPT_MIN_WORDS = 35;
export const PROMPT_MAX_WORDS = 55;

/** WPM 계산 기준: 1 word = 5 chars */
export const CHARS_PER_WORD = 5;

/** 티어 구간 */
export const TIERS = [
  { name: "Bronze", min: 0, max: 899 },
  { name: "Silver", min: 900, max: 1099 },
  { name: "Gold", min: 1100, max: 1299 },
  { name: "Platinum", min: 1300, max: 1499 },
  { name: "Diamond", min: 1500, max: Infinity },
] as const;

/** 비공개 방 초대 코드 길이 */
export const INVITE_CODE_LENGTH = 6;
```

- [ ] **Step 5: game.ts 작성 — zod 스키마 + 타입 정의**

```ts
// packages/shared/src/schemas/game.ts
import { z } from "zod";

export const MatchMode = z.enum(["ranked", "private", "practice"]);
export type MatchMode = z.infer<typeof MatchMode>;

export const MatchState = z.enum([
  "loading",
  "countdown",
  "racing",
  "finish_wait",
  "completed",
  "aborted",
  "forfeit",
]);
export type MatchState = z.infer<typeof MatchState>;

export const OutcomeType = z.enum([
  "completion",
  "timeout",
  "forfeit",
  "draw",
  "no_result",
]);
export type OutcomeType = z.infer<typeof OutcomeType>;

export const TierName = z.enum([
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
]);
export type TierName = z.infer<typeof TierName>;

/** 솔로 연습 결과 (클라이언트 로컬 계산) */
export const PracticeResult = z.object({
  promptId: z.string(),
  promptText: z.string(),
  correctChars: z.number().int().nonnegative(),
  totalKeystrokes: z.number().int().nonnegative(),
  elapsedMs: z.number().int().positive(),
  finished: z.boolean(),
});
export type PracticeResult = z.infer<typeof PracticeResult>;
```

- [ ] **Step 6: stats.test.ts 작성 — WPM, accuracy 테스트 먼저**

```ts
// packages/shared/src/utils/stats.test.ts
import { describe, it, expect } from "vitest";
import { calcWpm, calcAccuracy, calcProgress } from "./stats";

describe("calcWpm", () => {
  it("정상 케이스: 100자 60초 = 20 WPM", () => {
    expect(calcWpm(100, 60_000)).toBeCloseTo(20);
  });

  it("0초면 0 반환", () => {
    expect(calcWpm(100, 0)).toBe(0);
  });
});

describe("calcAccuracy", () => {
  it("100% 정확도", () => {
    expect(calcAccuracy(50, 0)).toBe(100);
  });

  it("80% 정확도: 40 correct, 10 incorrect", () => {
    expect(calcAccuracy(40, 10)).toBe(80);
  });

  it("입력 없으면 0 반환", () => {
    expect(calcAccuracy(0, 0)).toBe(0);
  });
});

describe("calcProgress", () => {
  it("절반 완료", () => {
    expect(calcProgress(50, 100)).toBeCloseTo(0.5);
  });

  it("프롬프트 길이 0이면 0 반환", () => {
    expect(calcProgress(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 7: 테스트 실행 — 실패 확인**

Run: `cd packages/shared && pnpm test`
Expected: FAIL — `calcWpm`, `calcAccuracy`, `calcProgress` not found

- [ ] **Step 8: stats.ts 구현**

```ts
// packages/shared/src/utils/stats.ts
import { CHARS_PER_WORD } from "../constants/game-rules";

/**
 * WPM 계산. 기능정의서 5.4절:
 * wpm = (correct_chars / 5) / (elapsed_seconds / 60)
 */
export function calcWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const elapsedMin = elapsedMs / 60_000;
  return correctChars / CHARS_PER_WORD / elapsedMin;
}

/**
 * 정확도 계산. 기능정의서 5.4절:
 * accuracy = correct / (correct + incorrect) * 100
 */
export function calcAccuracy(
  correctKeystrokes: number,
  incorrectKeystrokes: number
): number {
  const total = correctKeystrokes + incorrectKeystrokes;
  if (total === 0) return 0;
  return (correctKeystrokes / total) * 100;
}

/**
 * 진행률 계산. 기능정의서 5.4절:
 * progress = correct_chars / total_prompt_chars
 */
export function calcProgress(
  correctChars: number,
  totalPromptChars: number
): number {
  if (totalPromptChars <= 0) return 0;
  return correctChars / totalPromptChars;
}
```

- [ ] **Step 9: 테스트 실행 — 통과 확인**

Run: `cd packages/shared && pnpm test`
Expected: 모든 테스트 PASS

- [ ] **Step 10: rating.test.ts 작성 — Elo RS 테스트 먼저**

```ts
// packages/shared/src/utils/rating.test.ts
import { describe, it, expect } from "vitest";
import { calcRatingDelta, getTierForRs } from "./rating";

describe("calcRatingDelta", () => {
  it("동일 RS 승리: K=32이면 +16", () => {
    const delta = calcRatingDelta(1000, 1000, 1, 20);
    // expected = 0.5, delta = 32 * (1 - 0.5) = 16
    expect(delta).toBe(16);
  });

  it("동일 RS 패배: K=32이면 -16", () => {
    const delta = calcRatingDelta(1000, 1000, 0, 20);
    expect(delta).toBe(-16);
  });

  it("provisional이면 K=48 사용", () => {
    const delta = calcRatingDelta(1000, 1000, 1, 5);
    // K=48, delta = 48 * 0.5 = 24
    expect(delta).toBe(24);
  });

  it("약자가 강자를 이기면 큰 보상", () => {
    const delta = calcRatingDelta(800, 1200, 1, 20);
    expect(delta).toBeGreaterThan(20);
  });
});

describe("getTierForRs", () => {
  it("Bronze: RS 500", () => {
    expect(getTierForRs(500)).toBe("Bronze");
  });

  it("Silver: RS 1000", () => {
    expect(getTierForRs(1000)).toBe("Silver");
  });

  it("Diamond: RS 1500", () => {
    expect(getTierForRs(1500)).toBe("Diamond");
  });
});
```

- [ ] **Step 11: 테스트 실행 — 실패 확인**

Run: `cd packages/shared && pnpm test`
Expected: rating 테스트 FAIL

- [ ] **Step 12: rating.ts 구현**

```ts
// packages/shared/src/utils/rating.ts
import {
  K_PROVISIONAL,
  K_NORMAL,
  PROVISIONAL_GAMES,
  TIERS,
} from "../constants/game-rules";
import type { TierName } from "../schemas/game";

/**
 * RS 변동 계산. 기능정의서 6.2절:
 * expected = 1 / (1 + 10^((opponent - my) / 400))
 * k = 48 if games < 10 else 32
 * delta = round(k * (actual - expected))
 */
export function calcRatingDelta(
  myRs: number,
  opponentRs: number,
  actual: number, // 1=승, 0=패, 0.5=무승부
  rankedGames: number
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRs - myRs) / 400));
  const k = rankedGames < PROVISIONAL_GAMES ? K_PROVISIONAL : K_NORMAL;
  return Math.round(k * (actual - expected));
}

/**
 * RS로 티어 이름 반환. 기능정의서 6.3절.
 */
export function getTierForRs(rs: number): TierName {
  for (const tier of TIERS) {
    if (rs >= tier.min && rs <= tier.max) {
      return tier.name;
    }
  }
  return "Bronze";
}
```

- [ ] **Step 13: 테스트 실행 — 전체 통과 확인**

Run: `cd packages/shared && pnpm test`
Expected: 모든 테스트 PASS

- [ ] **Step 14: index.ts 작성 — 배럴 export**

```ts
// packages/shared/src/index.ts
export * from "./constants/game-rules";
export * from "./schemas/game";
export * from "./utils/stats";
export * from "./utils/rating";
```

- [ ] **Step 15: pnpm install 후 빌드 확인**

Run: `pnpm install && pnpm test`
Expected: workspace 인식, shared 테스트 통과

- [ ] **Step 16: 커밋**

```bash
git add packages/shared/
git commit -m "shared 패키지: 게임 상수, 타입, WPM/정확도/Elo 계산 유틸 + 테스트"
```

---

## Task 3: Prisma 스키마 + Docker Compose + 마이그레이션

**Files:**
- Create: `prisma/schema.prisma`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (gitignored)

- [ ] **Step 1: docker-compose.yml 작성**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: arena
      POSTGRES_PASSWORD: arena_local
      POSTGRES_DB: type_arena
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

- [ ] **Step 2: .env.example 및 .env 작성**

```env
# .env.example (커밋됨)
DATABASE_URL=postgresql://arena:arena_local@localhost:5432/type_arena
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
WS_PORT=8080
WS_CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

`.env`는 동일 내용으로 생성 (gitignored).

- [ ] **Step 3: prisma/schema.prisma 작성**

설계서 4장의 전체 Prisma 스키마를 그대로 작성한다. `generator`와 `datasource` 블록을 포함:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model UserAccount {
  id          String   @id @default(cuid())
  googleSub   String?  @unique
  displayName String
  email       String?  @unique
  status      String   @default("active")
  betaAccess  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("user_account")
}

model GuestSession {
  id              String   @id @default(cuid())
  nickname        String
  fingerprintHash String?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  @@map("guest_session")
}

model BetaInvite {
  code      String    @id
  status    String    @default("active")
  maxUses   Int       @default(1)
  usedCount Int       @default(0)
  expiresAt DateTime?
  createdAt DateTime  @default(now())

  @@map("beta_invite")
}

model PromptCatalog {
  id             String   @id @default(cuid())
  language       String   @default("en")
  text           String
  normalizedText String
  checksum       String   @unique
  difficulty     String   @default("standard")
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())

  @@map("prompt_catalog")
}

model PrivateRoom {
  id         String   @id @default(cuid())
  inviteCode String   @unique
  status     String   @default("open")
  hostUserId String
  createdAt  DateTime @default(now())
  expiresAt  DateTime

  @@map("private_room")
}

model RoomParticipant {
  id              String   @id @default(cuid())
  roomId          String
  participantType String
  participantId   String
  slot            Int
  readyState      Boolean  @default(false)
  joinedAt        DateTime @default(now())

  @@unique([roomId, slot])
  @@map("room_participant")
}

model Match {
  id                  String    @id @default(cuid())
  mode                String
  region              String?
  promptId            String
  state               String
  serverStartAt       DateTime?
  startedAt           DateTime?
  endedAt             DateTime?
  winnerParticipantId String?
  outcomeType         String?
  createdAt           DateTime  @default(now())

  @@map("match")
}

model MatchParticipant {
  id              String  @id @default(cuid())
  matchId         String
  participantType String
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
  @@map("match_participant")
}

model MatchEventLog {
  id             String   @id @default(cuid())
  matchId        String   @unique
  timeline       Json
  rejectedInputs Json?
  createdAt      DateTime @default(now())

  @@map("match_event_log")
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
  @@map("season_rating")
}

model Season {
  id        String    @id @default(cuid())
  name      String
  status    String    @default("active")
  startedAt DateTime  @default(now())
  endedAt   DateTime?

  @@index([status])
  @@map("season")
}

model AbuseReport {
  id         String   @id @default(cuid())
  matchId    String
  reporterId String
  reason     String
  createdAt  DateTime @default(now())

  @@map("abuse_report")
}
```

- [ ] **Step 4: Docker 실행 및 DB push**

Run:
```bash
docker compose up -d
pnpm add -w prisma @prisma/client
pnpm exec prisma db push
```
Expected: PostgreSQL 기동, 스키마 반영 성공

- [ ] **Step 5: prisma generate 확인**

Run: `pnpm exec prisma generate`
Expected: `@prisma/client` 타입 생성 완료

- [ ] **Step 6: 커밋**

```bash
git add prisma/ docker-compose.yml .env.example
git commit -m "DB 기반: Prisma 스키마 + Docker Compose (PostgreSQL 16 + Redis 7)"
```

---

## Task 4: Next.js 기본 설정

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/lib/prisma.ts`

- [ ] **Step 1: apps/web/package.json 작성**

```json
{
  "name": "@type-arena/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@prisma/client": "^6",
    "@type-arena/shared": "workspace:*",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "typescript": "^5.7"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.ts 작성**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@type-arena/shared"],
};

export default nextConfig;
```

- [ ] **Step 4: Tailwind CSS 4 설정**

`postcss.config.mjs`:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

`app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 5: app/layout.tsx 작성**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Type Arena",
  description: "Competitive typing game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: lib/prisma.ts 작성**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 7: pnpm install 및 dev 서버 확인**

Run:
```bash
pnpm install
pnpm --filter @type-arena/web dev
```
Expected: `http://localhost:3000`에서 빈 페이지 표시 (404는 정상, page.tsx 미작성)

- [ ] **Step 8: 커밋**

```bash
git add apps/web/
git commit -m "Next.js 15 기본 설정: App Router + Tailwind CSS 4 + Prisma 클라이언트"
```

---

## Task 5: 프롬프트 시드 데이터

**Files:**
- Create: `prisma/seed.ts`
- Modify: root `package.json` — prisma seed 스크립트 설정

- [ ] **Step 1: prisma/seed.ts 작성**

영어 타이핑 프롬프트 10개 + Season 0 생성. 기능정의서 5.1절의 규격(35-55 단어, 영문+기본 구두점만) 준수.

```ts
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const prompts = [
  "The quick brown fox jumps over the lazy dog near the river bank. Birds sing softly in the morning light while clouds drift across the pale blue sky above the quiet village.",
  "Technology has transformed the way we communicate with each other. From simple letters to instant messages, the speed of human connection continues to grow at a remarkable pace.",
  "Every great achievement begins with a single step forward. The journey may be long and difficult, but those who persist will find that their efforts are rewarded in unexpected ways.",
  "The ocean waves crashed against the rocky shore as the sun began to set behind the distant mountains. A cool breeze carried the scent of salt and pine through the evening air.",
  "Learning a new skill requires patience and dedication. Whether it is playing music, writing code, or mastering a sport, consistent practice is the key to steady improvement.",
  "The old library stood at the corner of the street, its shelves filled with stories from every corner of the world. Each book held a different adventure waiting to be discovered.",
  "Clear communication is essential in every aspect of life. The ability to express ideas simply and listen carefully can make the difference between success and failure in any project.",
  "Rain fell steadily on the tin roof, creating a gentle rhythm that filled the small cabin. Inside, a warm fire crackled softly as the evening settled into peaceful silence.",
  "The garden was full of color in the early spring. Bright flowers bloomed along the winding path, and the sweet fragrance of blossoms attracted butterflies from the nearby meadow.",
  "Science and curiosity have always driven humanity forward. By asking questions and seeking answers, we have built a world that our ancestors could never have imagined possible.",
];

async function main() {
  // Season 0
  await prisma.season.upsert({
    where: { id: "season-0" },
    update: {},
    create: {
      id: "season-0",
      name: "Season 0",
      status: "active",
    },
  });

  // Prompts
  for (const text of prompts) {
    const normalized = normalize(text);
    const hash = checksum(normalized);
    await prisma.promptCatalog.upsert({
      where: { checksum: hash },
      update: {},
      create: {
        text,
        normalizedText: normalized,
        checksum: hash,
      },
    });
  }

  console.log(`Seeded: 1 season, ${prompts.length} prompts`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: package.json에 prisma seed 설정 추가**

root `package.json`에 추가:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

그리고 tsx 설치: `pnpm add -wD tsx`

- [ ] **Step 3: 시드 실행 확인**

Run:
```bash
docker compose up -d
pnpm exec prisma db push
pnpm exec prisma db seed
```
Expected: `Seeded: 1 season, 10 prompts` 출력

- [ ] **Step 4: 커밋**

```bash
git add prisma/seed.ts package.json pnpm-lock.yaml
git commit -m "프롬프트 시드 데이터: 영어 타이핑 프롬프트 10개 + Season 0"
```

---

## Task 6: 게스트 세션 API

**Files:**
- Create: `apps/web/app/api/v1/guest-sessions/route.ts`

- [ ] **Step 1: route.ts 작성**

```ts
// apps/web/app/api/v1/guest-sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADJECTIVES = ["Swift", "Bold", "Keen", "Bright", "Quick", "Sharp", "Cool", "Fast"];
const NOUNS = ["Typist", "Racer", "Runner", "Dasher", "Writer", "Coder", "Player", "Striker"];

function randomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

export async function POST() {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간
  const session = await prisma.guestSession.create({
    data: {
      nickname: randomNickname(),
      expiresAt,
    },
  });

  // TODO(Phase 2): JWT 토큰 생성하여 WS 서버 인증에 사용
  return NextResponse.json({
    id: session.id,
    nickname: session.nickname,
    expiresAt: session.expiresAt.toISOString(),
  });
}
```

- [ ] **Step 2: curl로 API 테스트**

Run (dev 서버 실행 상태에서):
```bash
curl -X POST http://localhost:3000/api/v1/guest-sessions | jq
```
Expected: `{ "id": "...", "nickname": "SwiftTypist123", "expiresAt": "..." }` 형태 응답

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/api/v1/guest-sessions/
git commit -m "게스트 세션 API: POST /v1/guest-sessions 구현"
```

---

## Task 7: Home 화면 (SCR-01)

**Files:**
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components/ui/button.tsx`

- [ ] **Step 1: button.tsx — 공통 버튼 컴포넌트**

```tsx
// apps/web/components/ui/button.tsx
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
  secondary: "bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700",
  ghost: "hover:bg-gray-800 text-gray-400",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Home page.tsx 작성**

기능정의서 SCR-01: Practice as Guest, Ranked(비활성), Create Room(비활성), Join by Code(비활성).
Phase 1에서는 Practice만 활성화.

```tsx
// apps/web/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">
          Type Arena
        </h1>
        <p className="text-gray-400 text-lg">
          Competitive typing. Pure speed.
        </p>
        <span className="inline-block mt-2 px-3 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded-full">
          Closed Beta
        </span>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/practice">
          <Button className="w-full text-lg py-4">
            Practice as Guest
          </Button>
        </Link>

        <Button variant="secondary" disabled className="w-full" title="Coming soon">
          Ranked
        </Button>

        <Button variant="secondary" disabled className="w-full" title="Coming soon">
          Create Private Room
        </Button>

        <Button variant="ghost" disabled className="w-full" title="Coming soon">
          Join by Code
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 브라우저 확인**

Run: `pnpm --filter @type-arena/web dev`
Navigate: `http://localhost:3000`
Expected: "Type Arena" 제목, "Practice as Guest" 버튼 클릭 가능, 나머지 비활성

- [ ] **Step 4: 커밋**

```bash
git add apps/web/app/page.tsx apps/web/components/ui/button.tsx
git commit -m "Home 화면 (SCR-01): Practice 진입점 + 비활성 Ranked/Room 버튼"
```

---

## Task 8: Race Screen — 솔로 연습 모드 (SCR-05)

**Files:**
- Create: `apps/web/lib/stores/race-store.ts`
- Create: `apps/web/components/race/prompt-display.tsx`
- Create: `apps/web/components/race/typing-input.tsx`
- Create: `apps/web/components/race/progress-bar.tsx`
- Create: `apps/web/components/race/countdown.tsx`
- Create: `apps/web/components/race/live-stats.tsx`
- Create: `apps/web/app/practice/page.tsx`
- Create: `apps/web/app/api/v1/practice-matches/route.ts`

이 태스크는 Phase 1의 핵심이다. 솔로 연습은 WS 서버 없이 **브라우저 로컬에서 입력 판정**을 수행한다.

- [ ] **Step 1: practice-matches API — 랜덤 프롬프트 반환**

```ts
// apps/web/app/api/v1/practice-matches/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // 활성 프롬프트 중 랜덤 1개 선택
  const count = await prisma.promptCatalog.count({ where: { active: true } });
  const skip = Math.floor(Math.random() * count);
  const prompt = await prisma.promptCatalog.findFirst({
    where: { active: true },
    skip,
  });

  if (!prompt) {
    return NextResponse.json({ error: "No prompts available" }, { status: 503 });
  }

  return NextResponse.json({
    promptId: prompt.id,
    text: prompt.normalizedText,
    checksum: prompt.checksum,
  });
}
```

- [ ] **Step 2: race-store.ts — Zustand 레이스 상태 관리**

기능정의서 5.2절 판정 규칙을 정확히 구현:
- 정확히 다음에 와야 할 문자 기준 판정
- 틀리면 mistake 상태, 수정 전까지 진행 불가
- Backspace로 오입력 제거

```ts
// apps/web/lib/stores/race-store.ts
"use client";
import { create } from "zustand";
import { calcWpm, calcAccuracy, calcProgress, MATCH_TIMEOUT_MS } from "@type-arena/shared";

export type RacePhase = "idle" | "countdown" | "racing" | "finished";

interface RaceState {
  phase: RacePhase;
  promptText: string;
  promptId: string;

  // 입력 상태
  cursorPos: number;       // 현재 확정된 정확 위치
  hasMistake: boolean;     // 현재 위치가 mistake인지
  mistakeChar: string;     // 잘못 입력한 문자

  // 통계
  correctChars: number;
  incorrectKeystrokes: number;
  totalKeystrokes: number;
  startedAt: number | null;
  finishedAt: number | null;

  // 계산된 값
  wpm: number;
  accuracy: number;
  progress: number;
  elapsedMs: number;

  // Actions
  init: (promptId: string, promptText: string) => void;
  startCountdown: () => void;
  startRacing: () => void;
  handleKeyPress: (key: string) => void;
  tick: () => void;
  reset: () => void;
}

export const useRaceStore = create<RaceState>((set, get) => ({
  phase: "idle",
  promptText: "",
  promptId: "",
  cursorPos: 0,
  hasMistake: false,
  mistakeChar: "",
  correctChars: 0,
  incorrectKeystrokes: 0,
  totalKeystrokes: 0,
  startedAt: null,
  finishedAt: null,
  wpm: 0,
  accuracy: 0,
  progress: 0,
  elapsedMs: 0,

  init: (promptId, promptText) =>
    set({
      phase: "idle",
      promptId,
      promptText,
      cursorPos: 0,
      hasMistake: false,
      mistakeChar: "",
      correctChars: 0,
      incorrectKeystrokes: 0,
      totalKeystrokes: 0,
      startedAt: null,
      finishedAt: null,
      wpm: 0,
      accuracy: 0,
      progress: 0,
      elapsedMs: 0,
    }),

  startCountdown: () => set({ phase: "countdown" }),

  startRacing: () => set({ phase: "racing", startedAt: Date.now() }),

  handleKeyPress: (key: string) => {
    const state = get();
    if (state.phase !== "racing") return;

    // Backspace 처리
    if (key === "Backspace") {
      if (state.hasMistake) {
        set({ hasMistake: false, mistakeChar: "" });
      }
      return;
    }

    // 단일 문자만 허용
    if (key.length !== 1) return;

    const newTotal = state.totalKeystrokes + 1;

    // mistake 상태에서 추가 입력은 무시 (Backspace로 먼저 해제해야 함)
    if (state.hasMistake) {
      set({ totalKeystrokes: newTotal, incorrectKeystrokes: state.incorrectKeystrokes + 1 });
      return;
    }

    const expected = state.promptText[state.cursorPos];

    if (key === expected) {
      const newCorrect = state.correctChars + 1;
      const newPos = state.cursorPos + 1;
      const finished = newPos >= state.promptText.length;

      set({
        cursorPos: newPos,
        correctChars: newCorrect,
        totalKeystrokes: newTotal,
        ...(finished
          ? { phase: "finished" as const, finishedAt: Date.now() }
          : {}),
      });
    } else {
      // mistake 발생
      set({
        hasMistake: true,
        mistakeChar: key,
        totalKeystrokes: newTotal,
        incorrectKeystrokes: state.incorrectKeystrokes + 1,
      });
    }
  },

  tick: () => {
    const state = get();
    if (state.phase !== "racing" || !state.startedAt) return;

    const elapsed = Date.now() - state.startedAt;

    // 120초 타임아웃 (기능정의서 5.3절)
    if (elapsed >= MATCH_TIMEOUT_MS) {
      set({ phase: "finished", finishedAt: Date.now(), elapsedMs: MATCH_TIMEOUT_MS });
      return;
    }

    set({
      elapsedMs: elapsed,
      wpm: calcWpm(state.correctChars, elapsed),
      accuracy: calcAccuracy(
        state.correctChars,
        state.incorrectKeystrokes
      ),
      progress: calcProgress(state.correctChars, state.promptText.length),
    });
  },

  reset: () =>
    set({
      phase: "idle",
      promptText: "",
      promptId: "",
      cursorPos: 0,
      hasMistake: false,
      mistakeChar: "",
      correctChars: 0,
      incorrectKeystrokes: 0,
      totalKeystrokes: 0,
      startedAt: null,
      finishedAt: null,
      wpm: 0,
      accuracy: 0,
      progress: 0,
      elapsedMs: 0,
    }),
}));
```

- [ ] **Step 3: prompt-display.tsx — 프롬프트 텍스트 렌더링**

각 문자를 완료/현재/미완/오류 상태로 색분류:

```tsx
// apps/web/components/race/prompt-display.tsx
"use client";
import { useRaceStore } from "@/lib/stores/race-store";

export function PromptDisplay() {
  const { promptText, cursorPos, hasMistake } = useRaceStore();

  return (
    <div className="text-2xl leading-relaxed font-mono select-none" aria-label="Typing prompt">
      {promptText.split("").map((char, i) => {
        let className = "text-gray-600"; // 미입력

        if (i < cursorPos) {
          className = "text-green-400"; // 정확히 입력 완료
        } else if (i === cursorPos) {
          if (hasMistake) {
            className = "bg-red-900/60 text-red-300"; // 오류
          } else {
            className = "bg-gray-700 text-white"; // 현재 커서
          }
        }

        return (
          <span key={i} className={className}>
            {char === " " && i === cursorPos ? "\u00B7" : char}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: typing-input.tsx — 키보드 입력 캡처**

```tsx
// apps/web/components/race/typing-input.tsx
"use client";
import { useEffect } from "react";
import { useRaceStore } from "@/lib/stores/race-store";

export function TypingInput() {
  const { phase, handleKeyPress } = useRaceStore();

  useEffect(() => {
    if (phase !== "racing") return;

    function onKeyDown(e: KeyboardEvent) {
      // 붙여넣기 차단 (기능정의서 5.2절)
      if (e.ctrlKey || e.metaKey) return;
      // IME 차단
      if (e.isComposing) return;

      e.preventDefault();
      handleKeyPress(e.key);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, handleKeyPress]);

  return null; // 비시각 컴포넌트, 키보드 이벤트만 처리
}
```

- [ ] **Step 5: progress-bar.tsx — 진행률 표시**

```tsx
// apps/web/components/race/progress-bar.tsx
"use client";
import { useRaceStore } from "@/lib/stores/race-store";

export function ProgressBar() {
  const progress = useRaceStore((s) => s.progress);

  return (
    <div className="w-full bg-gray-800 rounded-full h-2">
      <div
        className="bg-indigo-500 h-2 rounded-full transition-all duration-100"
        style={{ width: `${Math.min(progress * 100, 100)}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 6: countdown.tsx — 3초 카운트다운**

```tsx
// apps/web/components/race/countdown.tsx
"use client";
import { useEffect, useState } from "react";
import { useRaceStore } from "@/lib/stores/race-store";
import { COUNTDOWN_MS } from "@type-arena/shared";

export function Countdown() {
  const { phase, startRacing } = useRaceStore();
  const [count, setCount] = useState(Math.ceil(COUNTDOWN_MS / 1000));

  useEffect(() => {
    if (phase !== "countdown") return;

    setCount(Math.ceil(COUNTDOWN_MS / 1000));
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startRacing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, startRacing]);

  if (phase !== "countdown") return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
      <span className="text-8xl font-bold text-indigo-400 animate-pulse">
        {count}
      </span>
    </div>
  );
}
```

- [ ] **Step 7: live-stats.tsx — 실시간 WPM/정확도 표시**

```tsx
// apps/web/components/race/live-stats.tsx
"use client";
import { useEffect } from "react";
import { useRaceStore } from "@/lib/stores/race-store";

export function LiveStats() {
  const { phase, wpm, accuracy, elapsedMs, tick } = useRaceStore();

  useEffect(() => {
    if (phase !== "racing") return;
    const interval = setInterval(tick, 100); // 100ms마다 갱신
    return () => clearInterval(interval);
  }, [phase, tick]);

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="flex gap-8 text-sm text-gray-400">
      <div>
        <span className="text-2xl font-bold text-white">{Math.round(wpm)}</span>
        <span className="ml-1">WPM</span>
      </div>
      <div>
        <span className="text-2xl font-bold text-white">
          {accuracy > 0 ? `${accuracy.toFixed(1)}` : "---"}
        </span>
        <span className="ml-1">%</span>
      </div>
      <div>
        <span className="text-2xl font-bold text-white">{seconds}</span>
        <span className="ml-1">s</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: practice/page.tsx — 솔로 연습 페이지 조합**

```tsx
// apps/web/app/practice/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRaceStore } from "@/lib/stores/race-store";
import { PromptDisplay } from "@/components/race/prompt-display";
import { TypingInput } from "@/components/race/typing-input";
import { ProgressBar } from "@/components/race/progress-bar";
import { Countdown } from "@/components/race/countdown";
import { LiveStats } from "@/components/race/live-stats";

export default function PracticePage() {
  const router = useRouter();
  const { phase, init, startCountdown } = useRaceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrompt() {
      try {
        const res = await fetch("/api/v1/practice-matches", { method: "POST" });
        if (!res.ok) throw new Error("프롬프트 로드 실패");
        const data = await res.json();
        init(data.promptId, data.text);
        setLoading(false);
        // 자동으로 카운트다운 시작
        startCountdown();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      }
    }
    loadPrompt();
  }, [init, startCountdown]);

  // 경기 완료 시 결과 페이지로 이동
  useEffect(() => {
    if (phase === "finished") {
      const state = useRaceStore.getState();
      const params = new URLSearchParams({
        wpm: Math.round(state.wpm).toString(),
        accuracy: state.accuracy.toFixed(1),
        elapsed: state.elapsedMs.toString(),
        chars: state.correctChars.toString(),
        keystrokes: state.totalKeystrokes.toString(),
        promptId: state.promptId,
      });
      router.push(`/practice/result?${params}`);
    }
  }, [phase, router]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-xl">Loading prompt...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
      <Countdown />
      <TypingInput />

      <div className="w-full max-w-3xl space-y-6">
        <ProgressBar />
        <PromptDisplay />
        <LiveStats />
      </div>

      <p className="text-gray-600 text-sm mt-4">
        {phase === "racing" ? "Start typing..." : "Get ready..."}
      </p>
    </main>
  );
}
```

- [ ] **Step 9: 브라우저에서 연습 플로우 테스트**

Run: `pnpm --filter @type-arena/web dev`
Steps:
1. `http://localhost:3000` → "Practice as Guest" 클릭
2. 카운트다운 3-2-1 표시 확인
3. 프롬프트 텍스트 표시 확인
4. 키보드 입력 시 문자별 녹색 전환 확인
5. 틀린 입력 시 빨간색 표시, Backspace로 해제 확인
6. WPM, 정확도 실시간 갱신 확인

- [ ] **Step 10: 커밋**

```bash
git add apps/web/lib/stores/ apps/web/components/race/ apps/web/app/practice/ apps/web/app/api/v1/practice-matches/
git commit -m "Race Screen 솔로 연습: 프롬프트 표시, 입력 판정, 카운트다운, 실시간 WPM/정확도"
```

---

## Task 9: Results Screen (SCR-06) — 솔로 연습 결과

**Files:**
- Create: `apps/web/app/practice/result/page.tsx`

- [ ] **Step 1: result/page.tsx 작성**

```tsx
// apps/web/app/practice/result/page.tsx
"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function ResultContent() {
  const params = useSearchParams();

  const wpm = params.get("wpm") ?? "0";
  const accuracy = params.get("accuracy") ?? "0";
  const elapsed = Number(params.get("elapsed") ?? 0);
  const chars = params.get("chars") ?? "0";
  const keystrokes = params.get("keystrokes") ?? "0";

  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-8">
      <h1 className="text-4xl font-bold text-indigo-400">Practice Complete</h1>

      <div className="grid grid-cols-2 gap-6 w-full max-w-md">
        <StatCard label="WPM" value={wpm} />
        <StatCard label="Accuracy" value={`${accuracy}%`} />
        <StatCard label="Time" value={`${seconds}s`} />
        <StatCard label="Characters" value={`${chars}/${keystrokes}`} />
      </div>

      <div className="flex gap-4 mt-4">
        <Link href="/practice">
          <Button>Try Again</Button>
        </Link>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>

      <p className="text-gray-600 text-sm">
        Sign up for Ranked to compete against others!
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading...</p>}>
      <ResultContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: E2E 플로우 테스트**

Run: `pnpm --filter @type-arena/web dev`
Steps:
1. Home → Practice → 카운트다운 → 타이핑 → 완료
2. 결과 화면에 WPM, Accuracy, Time, Characters 표시 확인
3. "Try Again" → 새 프롬프트로 연습 재시작 확인
4. "Home" → 홈 화면 복귀 확인

- [ ] **Step 3: 커밋**

```bash
git add apps/web/app/practice/result/
git commit -m "Results Screen: 솔로 연습 결과 (WPM, 정확도, 시간, Try Again/Home)"
```

---

## Task 10: 최종 통합 테스트 및 정리

**Files:**
- Modify: `apps/web/app/page.tsx` (필요시 미세 조정)

- [ ] **Step 1: 전체 플로우 검증**

Run: `pnpm --filter @type-arena/web dev`
Checklist:
1. `http://localhost:3000` — Home 화면 렌더링
2. "Practice as Guest" 클릭 → `/practice`
3. 카운트다운 3→2→1 후 racing 시작
4. 정확한 입력 → 녹색 전환, 진행바 증가
5. 틀린 입력 → 빨간색, Backspace로 해제
6. WPM, 정확도 실시간 갱신
7. 전체 프롬프트 완료 → `/practice/result` 자동 이동
8. 결과 화면 스탯 확인
9. "Try Again" → 새 프롬프트로 재시작
10. "Home" → 홈 복귀

- [ ] **Step 2: pnpm build 통과 확인**

Run: `pnpm build`
Expected: Next.js 빌드 성공, 에러 없음

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "Phase 1 완료: 솔로 연습 전체 플로우 (Home → Race → Result → Home)"
```

---

## Phase 1 완료 조건

- [ ] Home 화면에서 Practice 진입 가능
- [ ] 카운트다운 후 레이스 시작
- [ ] 입력 판정이 기능정의서 5.2절과 일치 (대소문자/공백/구두점 정확히 일치)
- [ ] WPM, 정확도, 진행률이 실시간 갱신
- [ ] 결과 화면에 스탯 표시
- [ ] Try Again / Home 네비게이션 동작
- [ ] `pnpm build` 성공
- [ ] 모든 shared 유틸 테스트 통과

---

## 후속 Phase 요약

Phase 1 완료 후 각 Phase는 별도 상세 계획을 작성한다:

- **Phase 2**: Google OAuth + WS 서버 + 서버 권위 입력 판정 + 1v1 실시간 대결
- **Phase 3**: 비공개 방 생성/참가/Ready/Start/Rematch
- **Phase 4**: 랭크전 매치메이킹 + RS + 리더보드 + 프로필
- **Phase 5**: 배포(Vercel+Railway) + 관리자 기능 + 안정화
