# Phase 2: 인증 + 실시간 엔진 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 Google OAuth로 인증하고, WS 서버를 통해 다른 사용자와 서버 권위 실시간 1v1 타이핑 대결을 완주할 수 있다.

**Architecture:**

- Google OAuth via next-auth@beta (NextAuth.js v5 App Router 지원)
- 독립 WS 서버 (`apps/ws-server/`) — Node.js 20 + ws@8 + Fastify@4 헬스체크
- WS 인증: 로그인 후 `/api/v1/auth/ws-token`에서 커스텀 JWT 발급(5분 TTL, `WS_JWT_SECRET`), 클라이언트가 첫 메시지 `session.auth`로 전달
- 간이 FIFO 매치메이킹: 인메모리 대기열 (Elo는 Phase 4에서 추가)
- 서버 권위 입력 판정: `race.input` → 서버 재계산 → `race.progress` 브로드캐스트
- 경기 완료: Prisma로 DB 저장 → `race.result` 이벤트 발송

**Tech Stack:** next-auth@beta, jsonwebtoken@9, ws@8, fastify@4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-typing-arena-technical-design.md`
**Requirements:** `2026-03-19-typing-arena-mvp-design.md`

---

## File Map

### New Files Created in Phase 2

```
type-arena/
├── packages/
│   └── shared/
│       └── src/
│           └── schemas/
│               └── ws-events.ts          # Task 1 — WS 이벤트 타입
├── apps/
│   ├── web/
│   │   ├── lib/
│   │   │   ├── auth.ts                   # Task 2 — NextAuth.js v5 설정
│   │   │   ├── ws-client.ts              # Task 9 — WS 클라이언트 래퍼
│   │   │   └── stores/
│   │   │       └── match-store.ts        # Task 9 — 매치 상태 Zustand 스토어
│   │   ├── components/
│   │   │   ├── providers.tsx             # Task 2 — SessionProvider 래퍼
│   │   │   └── race/
│   │   │       └── opponent-progress.tsx # Task 10 — 상대 진행률 바
│   │   └── app/
│   │       ├── api/
│   │       │   ├── auth/
│   │       │   │   └── [...nextauth]/
│   │       │   │       └── route.ts      # Task 2 — NextAuth 라우트 핸들러
│   │       │   └── v1/
│   │       │       ├── me/
│   │       │       │   └── route.ts      # Task 2 — GET /v1/me
│   │       │       └── auth/
│   │       │           └── ws-token/
│   │       │               └── route.ts  # Task 3 — WS 토큰 발급
│   │       ├── auth/
│   │       │   └── page.tsx              # Task 3 — SCR-02 Auth 화면
│   │       ├── ranked/
│   │       │   └── page.tsx              # Task 10 — SCR-03 Ranked Queue
│   │       └── match/
│   │           └── [id]/
│   │               ├── race/
│   │               │   └── page.tsx      # Task 10 — WS 기반 Race Screen
│   │               └── result/
│   │                   └── page.tsx      # Task 10 — WS 기반 Result Screen
│   └── ws-server/
│       ├── package.json                  # Task 4
│       ├── tsconfig.json                 # Task 4
│       ├── vitest.config.ts              # Task 6
│       └── src/
│           ├── index.ts                  # Task 4 — Fastify + WebSocketServer
│           ├── config.ts                 # Task 4 — 환경변수
│           ├── types.ts                  # Task 4 — Connection / LiveMatch 타입
│           ├── utils.ts                  # Task 4 — sendRaw 헬퍼
│           ├── connection-store.ts       # Task 4 — 연결/매치 인메모리 관리
│           ├── router.ts                 # Task 4 — 이벤트 라우터
│           ├── handlers/
│           │   ├── session.ts            # Task 5 — session.auth, ping
│           │   ├── queue.ts              # Task 7 — queue.join/leave
│           │   └── race.ts              # Task 8 — match.loaded, race.input, race.leave
│           ├── engine/
│           │   ├── input-judge.ts        # Task 6 — 서버 입력 판정 (TDD)
│           │   └── input-judge.test.ts   # Task 6 — TDD 테스트
│           └── services/
│               └── db.ts                 # Task 4 — Prisma 클라이언트

### Modified Files in Phase 2

- `packages/shared/src/index.ts`         — Task 1: ws-events 익스포트 추가
- `apps/web/app/layout.tsx`              — Task 2: Providers 래퍼 추가
- `apps/web/app/page.tsx`               — Task 3: 로그인 상태 반영 (Server Component)
- `apps/web/next.config.ts`             — Task 2: next-auth 서버 외부 패키지 설정
- `.env.example`                         — Task 2: 신규 환경변수 추가
- `.env`                                 — Task 2: 로컬 환경변수 추가
- `turbo.json`                           — Task 4: ws-server 빌드 output 추가
```

---

## Task 1: shared — WebSocket 이벤트 스키마

**Files:**

- Create: `packages/shared/src/schemas/ws-events.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: ws-events.ts 작성**

클라이언트→서버 이벤트는 zod 스키마로 정의해 런타임 검증에 사용한다. 서버→클라이언트 이벤트는 TypeScript 인터페이스로만 정의한다 (서버가 생성하므로 런타임 검증 불필요).

```ts
// packages/shared/src/schemas/ws-events.ts
import { z } from "zod";

// ─────────────────── Client → Server (zod 스키마) ───────────────────

export const SessionAuthEvent = z.object({
  type: z.literal("session.auth"),
  token: z.string(), // WS JWT
});

export const QueueJoinEvent = z.object({
  type: z.literal("queue.join"),
  mode: z.literal("ranked"),
});

export const QueueLeaveEvent = z.object({
  type: z.literal("queue.leave"),
  reason: z.string().optional(),
});

export const MatchLoadedEvent = z.object({
  type: z.literal("match.loaded"),
  matchId: z.string(),
});

export const RaceInputEvent = z.object({
  type: z.literal("race.input"),
  matchId: z.string(),
  seq: z.number().int().nonnegative(),
  kind: z.enum(["type", "backspace"]),
  value: z.string().max(1).optional(), // 단일 문자 (kind="type" 시에만)
});

export const RaceLeaveEvent = z.object({
  type: z.literal("race.leave"),
  matchId: z.string(),
  reason: z.string().optional(),
});

export const PingEvent = z.object({
  type: z.literal("ping"),
  clientTs: z.number(),
});

export const ClientEvent = z.discriminatedUnion("type", [
  SessionAuthEvent,
  QueueJoinEvent,
  QueueLeaveEvent,
  MatchLoadedEvent,
  RaceInputEvent,
  RaceLeaveEvent,
  PingEvent,
]);
export type ClientEvent = z.infer<typeof ClientEvent>;

// ─────────────────── Server → Client (TypeScript 인터페이스) ───────────────────

export interface SessionOkEvent {
  type: "session.ok";
  participantId: string;
  participantType: "user" | "guest";
  nickname: string;
}

export interface QueueStatusEvent {
  type: "queue.status";
  state: "queuing" | "matched" | "timeout";
  estimatedWait?: number;
}

export interface MatchAssignedEvent {
  type: "match.assigned";
  matchId: string;
  promptText: string;
  promptId: string;
  checksum: string;
  opponentNickname: string;
  slot: 0 | 1;
}

export interface CountdownStartEvent {
  type: "countdown.start";
  serverStartAt: number; // Unix timestamp ms — 클라이언트는 이 시각 기준으로 카운트다운 표시
}

export interface RaceProgressEvent {
  type: "race.progress";
  matchId: string;
  selfProgress: number; // 0~1
  selfWpm: number;
  selfAccuracy: number; // 0~100
  opponentProgress: number; // 0~1
  opponentWpm: number;
}

export interface OpponentPresenceEvent {
  type: "opponent.presence";
  status: "connected" | "reconnecting" | "forfeited";
}

export interface RaceResultEvent {
  type: "race.result";
  matchId: string;
  outcome: "win" | "loss" | "draw" | "forfeit" | "no_result";
  myStats: {
    wpm: number;
    accuracy: number;
    finishMs: number | null;
    correctChars: number;
  };
  opponentStats: {
    wpm: number;
    accuracy: number;
    finishMs: number | null;
  };
}

export interface PongEvent {
  type: "pong";
  serverTs: number;
}

export interface WsErrorEvent {
  type: "error";
  code: string;
  message: string;
  retryable: boolean;
}

export type ServerEvent =
  | SessionOkEvent
  | QueueStatusEvent
  | MatchAssignedEvent
  | CountdownStartEvent
  | RaceProgressEvent
  | OpponentPresenceEvent
  | RaceResultEvent
  | PongEvent
  | WsErrorEvent;
```

- [ ] **Step 2: shared/src/index.ts에 ws-events 익스포트 추가**

```ts
// packages/shared/src/index.ts (기존 줄 유지, 아래 줄 추가)
export * from "./schemas/ws-events";
```

- [ ] **Step 3: shared 패키지 빌드 확인**

Run: `pnpm --filter @type-arena/shared build`
Expected: 에러 없음, `dist/` 생성

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/schemas/ws-events.ts packages/shared/src/index.ts
git commit -m "shared: WebSocket 이벤트 스키마 정의 (Client/Server 이벤트 타입)"
```

---

## Task 2: Google OAuth + NextAuth.js v5 + /me API

**Files:**

- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/components/providers.tsx`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/app/api/v1/me/route.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/next.config.ts`
- Modify: `.env.example`, `.env`

- [ ] **Step 1: next-auth@beta + jsonwebtoken 설치**

```bash
pnpm --filter @type-arena/web add next-auth@beta jsonwebtoken
pnpm --filter @type-arena/web add -D @types/jsonwebtoken
```

- [ ] **Step 2: 환경변수 추가**

`.env.example` (기존 내용 유지, 아래 추가):

```
# Google OAuth (Phase 2)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# WS Server JWT (Phase 2) — NEXTAUTH_SECRET과 별도
WS_JWT_SECRET=change-this-to-a-random-64-char-string

# WS Server URL (Phase 2)
NEXT_PUBLIC_WS_URL=ws://localhost:8081
WS_PORT=8081
WS_CORS_ORIGIN=http://localhost:3000
```

`.env` (로컬 개발용, 기존 내용 유지, 아래 추가):

```
GOOGLE_CLIENT_ID=placeholder-set-real-value-for-oauth
GOOGLE_CLIENT_SECRET=placeholder-set-real-value-for-oauth
WS_JWT_SECRET=dev-ws-secret-change-in-production-must-be-long
NEXT_PUBLIC_WS_URL=ws://localhost:8081
WS_PORT=8081
WS_CORS_ORIGIN=http://localhost:3000
```

> **주의:** Google OAuth를 실제로 테스트하려면 Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`를 실제 값으로 설정해야 한다. 개발 단계에서는 `http://localhost:3000/api/auth/callback/google`을 Authorized redirect URI에 추가해야 한다.

- [ ] **Step 3: apps/web/lib/auth.ts 작성**

```ts
// apps/web/lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // account가 있으면 최초 로그인 또는 재인증
      if (account?.provider === "google" && profile) {
        const dbUser = await prisma.userAccount.upsert({
          where: { googleSub: profile.sub! },
          update: { displayName: profile.name ?? "Player" },
          create: {
            googleSub: profile.sub!,
            displayName: profile.name ?? "Player",
            email: profile.email ?? undefined,
            betaAccess: true, // MVP: 모든 신규 유저 베타 허용
          },
        });
        token.sub = dbUser.id; // NextAuth sub → DB ID로 덮어씀
        token.nickname = dbUser.displayName;
        token.betaAccess = dbUser.betaAccess;
      }
      return token;
    },
    async session({ session, token }) {
      // session.user에 DB ID와 nickname 주입
      session.user.id = token.sub as string;
      session.user.name = token.nickname as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth", // 커스텀 로그인 페이지
  },
});
```

- [ ] **Step 4: SessionProvider 래퍼 컴포넌트 작성**

```tsx
// apps/web/components/providers.tsx
"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 5: NextAuth 라우트 핸들러 작성**

```ts
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 6: GET /v1/me API 작성**

```ts
// apps/web/app/api/v1/me/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.userAccount.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      status: true,
      betaAccess: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
```

- [ ] **Step 7: layout.tsx에 Providers 추가**

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: next.config.ts — next-auth 서버 외부 패키지 설정**

```ts
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@type-arena/shared"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
```

- [ ] **Step 9: 빌드 확인**

Run: `pnpm --filter @type-arena/web build`
Expected: 빌드 성공 (Google OAuth 자격증명이 없어도 빌드는 통과)

- [ ] **Step 10: 커밋**

```bash
git add apps/web/lib/auth.ts apps/web/components/providers.tsx \
  apps/web/app/api/auth/ apps/web/app/api/v1/me/ \
  apps/web/app/layout.tsx apps/web/next.config.ts \
  .env.example pnpm-lock.yaml
git commit -m "Google OAuth + NextAuth.js v5: JWT 전략, /me API, SessionProvider"
```

---

## Task 3: WS 토큰 발급 API + SCR-02 Auth 화면 + Home 업데이트

**Files:**

- Create: `apps/web/app/api/v1/auth/ws-token/route.ts`
- Create: `apps/web/app/auth/page.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: WS 토큰 발급 API 작성**

로그인한 사용자에게 5분짜리 커스텀 JWT 발급. WS 서버가 `WS_JWT_SECRET`으로 검증.

```ts
// apps/web/app/api/v1/auth/ws-token/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import jwt from "jsonwebtoken";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = {
    sub: session.user.id,
    type: "user",
    nickname: session.user.name ?? "Player",
  };

  const token = jwt.sign(payload, process.env.WS_JWT_SECRET!, {
    expiresIn: "5m",
  });

  return NextResponse.json({
    token,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: SCR-02 Auth 화면 작성**

```tsx
// apps/web/app/auth/page.tsx
"use client";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AuthPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Sign in to Type Arena</h1>
        <p className="text-gray-400">
          Create an account to compete in Ranked matches.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          className="w-full flex items-center justify-center gap-3 py-4"
          onClick={() => signIn("google", { callbackUrl: "/ranked" })}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <Link
          href="/"
          className="text-center text-gray-500 text-sm hover:text-gray-400"
        >
          ← Back to Home
        </Link>
      </div>

      <p className="text-gray-600 text-xs text-center max-w-xs">
        By signing in, you agree to participate in our Closed Beta.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Home page.tsx를 Server Component로 업데이트**

로그인 상태에 따라 버튼 활성화 여부를 서버 사이드에서 결정한다.

```tsx
// apps/web/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">Type Arena</h1>
        <p className="text-gray-400 text-lg">Competitive typing. Pure speed.</p>
        <span className="inline-block mt-2 px-3 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded-full">
          Closed Beta
        </span>
        {user && (
          <p className="mt-3 text-gray-400 text-sm">
            Welcome back,{" "}
            <span className="text-white font-semibold">{user.name}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/practice">
          <Button className="w-full text-lg py-4">Practice as Guest</Button>
        </Link>

        {user ? (
          <Link href="/ranked">
            <Button variant="secondary" className="w-full">
              Ranked
            </Button>
          </Link>
        ) : (
          <Link href="/auth">
            <Button variant="secondary" className="w-full">
              Ranked{" "}
              <span className="text-gray-500 text-xs ml-1">(Sign in)</span>
            </Button>
          </Link>
        )}

        <Button
          variant="secondary"
          disabled
          className="w-full"
          title="Coming soon"
        >
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

- [ ] **Step 4: 빌드 확인**

Run: `pnpm --filter @type-arena/web build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add apps/web/app/api/v1/auth/ apps/web/app/auth/ apps/web/app/page.tsx
git commit -m "WS 토큰 API + SCR-02 Auth 화면 + Home 로그인 상태 반영"
```

---

## Task 4: WS 서버 스캐폴딩

**Files:**

- Create: `apps/ws-server/package.json`
- Create: `apps/ws-server/tsconfig.json`
- Create: `apps/ws-server/src/config.ts`
- Create: `apps/ws-server/src/types.ts`
- Create: `apps/ws-server/src/utils.ts`
- Create: `apps/ws-server/src/connection-store.ts`
- Create: `apps/ws-server/src/router.ts`
- Create: `apps/ws-server/src/services/db.ts`
- Create: `apps/ws-server/src/index.ts`
- Modify: `turbo.json`

- [ ] **Step 1: apps/ws-server/package.json 작성**

```json
{
  "name": "@type-arena/ws-server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^6",
    "@type-arena/shared": "workspace:*",
    "fastify": "^4",
    "jsonwebtoken": "^9",
    "ws": "^8",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9",
    "@types/node": "^20",
    "@types/ws": "^8",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 2: apps/ws-server/tsconfig.json 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022"],
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: src/config.ts 작성**

```ts
// apps/ws-server/src/config.ts
function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  WS_PORT: parseInt(process.env.WS_PORT ?? "8081", 10),
  CORS_ORIGIN: process.env.WS_CORS_ORIGIN ?? "http://localhost:3000",
  WS_JWT_SECRET: required("WS_JWT_SECRET"),
  DATABASE_URL: required("DATABASE_URL"),
};
```

- [ ] **Step 4: src/types.ts 작성**

```ts
// apps/ws-server/src/types.ts
import { WebSocket } from "ws";
import { JudgeState } from "./engine/input-judge";

export interface Connection {
  connId: string;
  ws: WebSocket;
  participantId: string | null;
  participantType: "user" | "guest" | null;
  nickname: string | null;
  matchId: string | null;
  matchSlot: 0 | 1 | null;
  authenticated: boolean;
}

export type MatchPhase =
  | "loading"
  | "countdown"
  | "racing"
  | "finish_wait"
  | "completed"
  | "aborted";

export interface LiveMatch {
  matchId: string;
  promptText: string;
  promptId: string;
  promptChecksum: string;
  // slot 0 = 먼저 들어온 플레이어, slot 1 = 두 번째
  connections: [Connection | null, Connection | null];
  nicknames: [string, string];
  participantIds: [string, string];
  judgeStates: [JudgeState, JudgeState];
  lastSeqs: [number, number];
  loadedFlags: [boolean, boolean];
  phase: MatchPhase;
  startedAt: number | null;
  finishMs: [number | null, number | null];
  raceTimer: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
}
```

- [ ] **Step 5: src/utils.ts 작성**

```ts
// apps/ws-server/src/utils.ts
import { WebSocket } from "ws";
import { ServerEvent } from "@type-arena/shared";

export function sendRaw(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function broadcastToMatch(
  connections: [
    import("./types").Connection | null,
    import("./types").Connection | null
  ],
  event: ServerEvent
): void {
  for (const conn of connections) {
    if (conn?.ws) sendRaw(conn.ws, event);
  }
}

export function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  retryable: boolean
): void {
  sendRaw(ws, { type: "error", code, message, retryable });
}
```

- [ ] **Step 6: src/connection-store.ts 작성**

```ts
// apps/ws-server/src/connection-store.ts
import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { Connection, LiveMatch } from "./types";

// 연결 관리
const connections = new Map<string, Connection>();
// 매치 관리 (matchId → LiveMatch)
const liveMatches = new Map<string, LiveMatch>();
// 간이 대기열: 큐에서 대기 중인 Connection
let waitingConnection: Connection | null = null;

export function createConnection(ws: WebSocket): Connection {
  const conn: Connection = {
    connId: randomUUID(),
    ws,
    participantId: null,
    participantType: null,
    nickname: null,
    matchId: null,
    matchSlot: null,
    authenticated: false,
  };
  connections.set(conn.connId, conn);
  return conn;
}

export function removeConnection(connId: string): void {
  connections.delete(connId);
}

export function getWaiting(): Connection | null {
  return waitingConnection;
}

export function setWaiting(conn: Connection | null): void {
  waitingConnection = conn;
}

export function getMatch(matchId: string): LiveMatch | undefined {
  return liveMatches.get(matchId);
}

export function setMatch(matchId: string, match: LiveMatch): void {
  liveMatches.set(matchId, match);
}

export function deleteMatch(matchId: string): void {
  liveMatches.delete(matchId);
}
```

- [ ] **Step 7: src/router.ts 작성**

```ts
// apps/ws-server/src/router.ts
import { ClientEvent } from "@type-arena/shared";
import { Connection } from "./types";
import { sendError } from "./utils";
import { handleSessionAuth, handlePing } from "./handlers/session";
import { handleQueueJoin, handleQueueLeave } from "./handlers/queue";
import {
  handleMatchLoaded,
  handleRaceInput,
  handleRaceLeave,
} from "./handlers/race";

export async function handleMessage(
  conn: Connection,
  raw: unknown
): Promise<void> {
  const parsed = ClientEvent.safeParse(raw);
  if (!parsed.success) {
    sendError(conn.ws, "INVALID_EVENT", "Unknown or malformed event", false);
    return;
  }

  const event = parsed.data;

  // session.auth와 ping은 인증 전에도 허용
  if (event.type === "session.auth") {
    return handleSessionAuth(conn, event);
  }
  if (event.type === "ping") {
    return handlePing(conn, event);
  }

  // 나머지 이벤트는 인증 필요
  if (!conn.authenticated) {
    sendError(conn.ws, "UNAUTHORIZED", "Send session.auth first", false);
    return;
  }

  switch (event.type) {
    case "queue.join":
      return handleQueueJoin(conn, event);
    case "queue.leave":
      return handleQueueLeave(conn, event);
    case "match.loaded":
      return handleMatchLoaded(conn, event);
    case "race.input":
      return handleRaceInput(conn, event);
    case "race.leave":
      return handleRaceLeave(conn, event);
  }
}
```

- [ ] **Step 8: src/services/db.ts 작성**

```ts
// apps/ws-server/src/services/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 9: src/index.ts 작성**

```ts
// apps/ws-server/src/index.ts
import Fastify from "fastify";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config";
import { createConnection, removeConnection } from "./connection-store";
import { handleMessage } from "./router";
import { handleDisconnect } from "./handlers/race";
import { sendError } from "./utils";

async function main() {
  const fastify = Fastify({ logger: true });

  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  const server = createServer(fastify.server);
  const wss = new WebSocketServer({
    server,
    verifyClient: (
      { origin }: { origin: string },
      cb: (result: boolean, code?: number, message?: string) => void
    ) => {
      const allowed = config.CORS_ORIGIN.split(",").map((s) => s.trim());
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        cb(true);
      } else {
        cb(false, 403, "Forbidden");
      }
    },
  });

  wss.on("connection", (ws: WebSocket) => {
    const conn = createConnection(ws);
    fastify.log.info(`WS connected: ${conn.connId}`);

    ws.on("message", async (data: Buffer) => {
      try {
        const raw = JSON.parse(data.toString()) as unknown;
        await handleMessage(conn, raw);
      } catch (err) {
        fastify.log.error(err, "Message handling error");
        sendError(ws, "INTERNAL_ERROR", "Internal server error", true);
      }
    });

    ws.on("close", () => {
      fastify.log.info(`WS disconnected: ${conn.connId}`);
      handleDisconnect(conn);
      removeConnection(conn.connId);
    });

    ws.on("error", (err: Error) => {
      fastify.log.error(err, `WS error: ${conn.connId}`);
    });
  });

  await fastify.ready();
  server.listen(config.WS_PORT, "0.0.0.0", () => {
    fastify.log.info(`WS server listening on port ${config.WS_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 10: pnpm install로 ws-server 의존성 설치**

Run: `pnpm install`
Expected: `@type-arena/ws-server` 의존성 설치됨

- [ ] **Step 11: turbo.json 업데이트 — ws-server build output 추가**

기존 turbo.json의 `"outputs"` 에 이미 `"dist/**"` 가 있으므로 변경 불필요. 확인만:

```bash
cat turbo.json
```

Expected: `"outputs": [".next/**", "dist/**"]` 포함

- [ ] **Step 12: WS 서버 헬스체크 확인**

터미널 1:

```bash
pnpm --filter @type-arena/ws-server dev
```

터미널 2:

```bash
curl http://localhost:8081/health
```

Expected: `{"status":"ok","ts":...}`

- [ ] **Step 13: 커밋**

```bash
git add apps/ws-server/
git commit -m "WS 서버 스캐폴딩: Fastify 헬스체크 + WebSocketServer + 연결 관리 + 라우터"
```

---

## Task 5: WS 세션 인증 핸들러 (session.auth → session.ok)

**Files:**

- Create: `apps/ws-server/src/handlers/session.ts`

- [ ] **Step 1: src/handlers/session.ts 작성**

```ts
// apps/ws-server/src/handlers/session.ts
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Connection } from "../types";
import { sendRaw, sendError } from "../utils";
import {
  SessionAuthEvent,
  PingEvent,
  SessionOkEvent,
} from "@type-arena/shared";

interface WsTokenPayload {
  sub: string;
  type: "user" | "guest";
  nickname: string;
  iat: number;
  exp: number;
}

export function handleSessionAuth(
  conn: Connection,
  event: typeof SessionAuthEvent._type
): void {
  let payload: WsTokenPayload;

  try {
    payload = jwt.verify(event.token, config.WS_JWT_SECRET) as WsTokenPayload;
  } catch {
    sendError(conn.ws, "AUTH_FAILED", "Invalid or expired token", false);
    return;
  }

  conn.participantId = payload.sub;
  conn.participantType = payload.type;
  conn.nickname = payload.nickname;
  conn.authenticated = true;

  const response: SessionOkEvent = {
    type: "session.ok",
    participantId: payload.sub,
    participantType: payload.type,
    nickname: payload.nickname,
  };
  sendRaw(conn.ws, response);
}

export function handlePing(
  conn: Connection,
  event: typeof PingEvent._type
): void {
  sendRaw(conn.ws, { type: "pong", serverTs: Date.now() });
}
```

- [ ] **Step 2: 수동 확인**

WS 서버를 실행하고 간단한 테스트:

```bash
# 터미널 1: WS 서버 실행
pnpm --filter @type-arena/ws-server dev

# 터미널 2: wscat 또는 websocat으로 연결 테스트 (설치 필요)
# wscat -c ws://localhost:8081
# 연결 후: {"type":"session.auth","token":"invalid-token"}
# Expected: {"type":"error","code":"AUTH_FAILED",...}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/ws-server/src/handlers/session.ts
git commit -m "WS 세션 인증: session.auth JWT 검증 → session.ok"
```

---

## Task 6: 서버 입력 판정 엔진 TDD (input-judge)

**Files:**

- Create: `apps/ws-server/vitest.config.ts`
- Create: `apps/ws-server/src/engine/input-judge.ts`
- Create: `apps/ws-server/src/engine/input-judge.test.ts`

- [ ] **Step 1: vitest.config.ts 작성**

```ts
// apps/ws-server/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: 실패하는 테스트 먼저 작성**

```ts
// apps/ws-server/src/engine/input-judge.test.ts
import { describe, it, expect } from "vitest";
import { createJudgeState, applyInput, JudgeState } from "./input-judge";

const PROMPT = "Hello, world!";

describe("createJudgeState", () => {
  it("초기 상태는 cursorPos=0, hasMistake=false", () => {
    const state = createJudgeState();
    expect(state.cursorPos).toBe(0);
    expect(state.hasMistake).toBe(false);
    expect(state.correctChars).toBe(0);
    expect(state.finished).toBe(false);
  });
});

describe("applyInput — 정확한 입력", () => {
  it("정확한 문자 입력 시 cursorPos + correctChars 증가", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "H");
    expect(state.cursorPos).toBe(1);
    expect(state.correctChars).toBe(1);
    expect(state.hasMistake).toBe(false);
  });

  it("마지막 문자 입력 시 finished = true", () => {
    let state = createJudgeState();
    for (const char of PROMPT) {
      state = applyInput(state, PROMPT, "type", char);
    }
    expect(state.finished).toBe(true);
    expect(state.correctChars).toBe(PROMPT.length);
  });
});

describe("applyInput — 오입력", () => {
  it("틀린 문자 입력 시 hasMistake=true, cursorPos 변화 없음", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X"); // 'H' 가 맞는데 'X' 입력
    expect(state.hasMistake).toBe(true);
    expect(state.cursorPos).toBe(0);
    expect(state.incorrectKeystrokes).toBe(1);
  });

  it("mistake 상태에서 추가 입력은 incorrectKeystrokes만 증가", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X");
    state = applyInput(state, PROMPT, "type", "Y");
    expect(state.incorrectKeystrokes).toBe(2);
    expect(state.cursorPos).toBe(0);
  });
});

describe("applyInput — Backspace", () => {
  it("mistake 상태에서 Backspace → hasMistake=false", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X");
    state = applyInput(state, PROMPT, "backspace", undefined);
    expect(state.hasMistake).toBe(false);
    expect(state.cursorPos).toBe(0);
  });

  it("mistake 없을 때 Backspace → 상태 변화 없음", () => {
    const state = createJudgeState();
    const next = applyInput(state, PROMPT, "backspace", undefined);
    expect(next.cursorPos).toBe(0);
    expect(next.hasMistake).toBe(false);
  });
});

describe("applyInput — 공백 문자 처리", () => {
  const SPACE_PROMPT = "hi there";

  it("공백 문자도 정확히 일치해야 진행", () => {
    let state = createJudgeState();
    state = applyInput(state, SPACE_PROMPT, "type", "h");
    state = applyInput(state, SPACE_PROMPT, "type", "i");
    state = applyInput(state, SPACE_PROMPT, "type", " ");
    expect(state.cursorPos).toBe(3);
    expect(state.correctChars).toBe(3);
  });
});

describe("applyInput — 완료 후 입력", () => {
  it("finished 상태에서는 추가 입력 무시", () => {
    let state = createJudgeState();
    for (const char of PROMPT) {
      state = applyInput(state, PROMPT, "type", char);
    }
    const before = { ...state };
    state = applyInput(state, PROMPT, "type", "X");
    expect(state.correctChars).toBe(before.correctChars);
    expect(state.cursorPos).toBe(before.cursorPos);
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @type-arena/ws-server test`
Expected: `input-judge.ts` 가 없으므로 import 에러 발생

- [ ] **Step 4: input-judge.ts 구현**

```ts
// apps/ws-server/src/engine/input-judge.ts

export interface JudgeState {
  cursorPos: number;
  hasMistake: boolean;
  correctChars: number;
  incorrectKeystrokes: number;
  totalKeystrokes: number;
  finished: boolean;
}

export function createJudgeState(): JudgeState {
  return {
    cursorPos: 0,
    hasMistake: false,
    correctChars: 0,
    incorrectKeystrokes: 0,
    totalKeystrokes: 0,
    finished: false,
  };
}

/**
 * 단일 입력 이벤트를 적용해 새 JudgeState를 반환 (순수 함수 — 불변).
 * 기능정의서 5.2절 판정 규칙 구현.
 */
export function applyInput(
  state: JudgeState,
  promptText: string,
  kind: "type" | "backspace",
  value?: string
): JudgeState {
  // 완료 후 입력 무시
  if (state.finished) return state;

  // Backspace 처리
  if (kind === "backspace") {
    if (state.hasMistake) {
      return { ...state, hasMistake: false };
    }
    return state; // mistake 없을 때 backspace는 무시
  }

  // 단일 문자만 허용
  if (!value || value.length !== 1) return state;

  const newTotal = state.totalKeystrokes + 1;

  // mistake 상태에서 추가 입력 — incorrectKeystrokes만 증가
  if (state.hasMistake) {
    return {
      ...state,
      totalKeystrokes: newTotal,
      incorrectKeystrokes: state.incorrectKeystrokes + 1,
    };
  }

  const expected = promptText[state.cursorPos];

  if (value === expected) {
    const newCorrect = state.correctChars + 1;
    const newPos = state.cursorPos + 1;
    const finished = newPos >= promptText.length;
    return {
      ...state,
      cursorPos: newPos,
      correctChars: newCorrect,
      totalKeystrokes: newTotal,
      finished,
    };
  } else {
    return {
      ...state,
      hasMistake: true,
      totalKeystrokes: newTotal,
      incorrectKeystrokes: state.incorrectKeystrokes + 1,
    };
  }
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @type-arena/ws-server test`
Expected: 모든 테스트 통과 (Pass)

- [ ] **Step 6: 커밋**

```bash
git add apps/ws-server/vitest.config.ts apps/ws-server/src/engine/
git commit -m "서버 입력 판정 엔진 TDD: input-judge.ts 구현 + 테스트 통과"
```

---

## Task 7: 간이 매치메이킹 + 경기 생성 (queue.join/leave)

**Files:**

- Create: `apps/ws-server/src/handlers/queue.ts`

Phase 2에서는 FIFO 큐: 먼저 들어온 플레이어가 대기, 두 번째가 들어오면 즉시 매칭.
Elo 기반 범위 매칭은 Phase 4에서 추가.

- [ ] **Step 1: src/handlers/queue.ts 작성**

```ts
// apps/ws-server/src/handlers/queue.ts
import { randomUUID } from "crypto";
import { MATCH_TIMEOUT_MS, COUNTDOWN_MS } from "@type-arena/shared";
import {
  QueueJoinEvent,
  QueueLeaveEvent,
  MatchAssignedEvent,
} from "@type-arena/shared";
import { Connection, LiveMatch } from "../types";
import { sendRaw, sendError, broadcastToMatch } from "../utils";
import { getWaiting, setWaiting, setMatch } from "../connection-store";
import { createJudgeState } from "../engine/input-judge";
import { prisma } from "../services/db";
import { startCountdown } from "./race";

export async function handleQueueJoin(
  conn: Connection,
  _event: typeof QueueJoinEvent._type
): Promise<void> {
  if (!conn.participantId || !conn.nickname) {
    sendError(conn.ws, "NOT_AUTHENTICATED", "Authenticate first", false);
    return;
  }

  if (conn.matchId) {
    sendError(conn.ws, "ALREADY_IN_MATCH", "Leave current match first", false);
    return;
  }

  const waiting = getWaiting();

  if (!waiting || waiting.connId === conn.connId) {
    // 이 플레이어가 첫 번째 — 대기열에 등록
    setWaiting(conn);
    sendRaw(conn.ws, {
      type: "queue.status",
      state: "queuing",
    });
    return;
  }

  // 두 번째 플레이어 → 즉시 매칭
  setWaiting(null);

  const matchId = randomUUID();

  // 프롬프트 랜덤 선택
  const count = await prisma.promptCatalog.count({ where: { active: true } });
  if (count === 0) {
    sendError(conn.ws, "NO_PROMPTS", "No prompts available", true);
    sendError(waiting.ws, "NO_PROMPTS", "No prompts available", true);
    return;
  }
  const skip = Math.floor(Math.random() * count);
  const prompt = await prisma.promptCatalog.findFirst({
    where: { active: true },
    skip,
  });
  if (!prompt) {
    sendError(conn.ws, "NO_PROMPTS", "No prompts available", true);
    return;
  }

  // LiveMatch 생성
  const match: LiveMatch = {
    matchId,
    promptText: prompt.normalizedText,
    promptId: prompt.id,
    promptChecksum: prompt.checksum,
    connections: [waiting, conn],
    nicknames: [waiting.nickname!, conn.nickname!],
    participantIds: [waiting.participantId!, conn.participantId!],
    judgeStates: [createJudgeState(), createJudgeState()],
    lastSeqs: [-1, -1],
    loadedFlags: [false, false],
    phase: "loading",
    startedAt: null,
    finishMs: [null, null],
    raceTimer: null,
    countdownTimer: null,
  };

  setMatch(matchId, match);

  // 연결에 matchId/slot 기록
  waiting.matchId = matchId;
  waiting.matchSlot = 0;
  conn.matchId = matchId;
  conn.matchSlot = 1;

  // match.assigned 이벤트 전송 (각자 상대 닉네임)
  const slot0Event: MatchAssignedEvent = {
    type: "match.assigned",
    matchId,
    promptText: prompt.normalizedText,
    promptId: prompt.id,
    checksum: prompt.checksum,
    opponentNickname: conn.nickname!,
    slot: 0,
  };
  const slot1Event: MatchAssignedEvent = {
    type: "match.assigned",
    matchId,
    promptText: prompt.normalizedText,
    promptId: prompt.id,
    checksum: prompt.checksum,
    opponentNickname: waiting.nickname!,
    slot: 1,
  };

  sendRaw(waiting.ws, slot0Event);
  sendRaw(conn.ws, slot1Event);
}

export function handleQueueLeave(
  conn: Connection,
  _event: typeof QueueLeaveEvent._type
): void {
  const waiting = getWaiting();
  if (waiting?.connId === conn.connId) {
    setWaiting(null);
  }
  sendRaw(conn.ws, { type: "queue.status", state: "matched" }); // 임시: 큐 이탈 확인
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/ws-server/src/handlers/queue.ts
git commit -m "간이 FIFO 매치메이킹: queue.join → match.assigned (2인 즉시 매칭)"
```

---

## Task 8: Race 핸들러 (match.loaded → countdown → race.input → race.result)

**Files:**

- Create: `apps/ws-server/src/handlers/race.ts`

- [ ] **Step 1: src/handlers/race.ts 작성**

```ts
// apps/ws-server/src/handlers/race.ts
import {
  MATCH_TIMEOUT_MS,
  COUNTDOWN_MS,
  CHARS_PER_WORD,
  MatchLoadedEvent,
  RaceInputEvent,
  RaceLeaveEvent,
  CountdownStartEvent,
  RaceProgressEvent,
  RaceResultEvent,
} from "@type-arena/shared";
import { Connection, LiveMatch } from "../types";
import { sendRaw, sendError, broadcastToMatch } from "../utils";
import { getMatch, deleteMatch } from "../connection-store";
import { applyInput } from "../engine/input-judge";
import { prisma } from "../services/db";

// ─── 공개 API (index.ts에서 호출) ─────────────────────────────────────

export function handleDisconnect(conn: Connection): void {
  if (!conn.matchId || conn.matchSlot === null) return;
  const match = getMatch(conn.matchId);
  if (!match || match.phase === "completed" || match.phase === "aborted")
    return;

  // 경기 중 연결 끊김 → forfeit 처리
  const opponentSlot = (1 - conn.matchSlot) as 0 | 1;
  broadcastToMatch(match.connections, {
    type: "opponent.presence",
    status: "forfeited",
  });

  finalizeMatch(match, opponentSlot, "forfeit");
}

// ─── 핸들러 ───────────────────────────────────────────────────────────

export function handleMatchLoaded(
  conn: Connection,
  event: typeof MatchLoadedEvent._type
): void {
  if (!conn.matchId || conn.matchSlot === null) {
    sendError(conn.ws, "NO_MATCH", "Not in a match", false);
    return;
  }
  const match = getMatch(conn.matchId);
  if (!match || match.matchId !== event.matchId) {
    sendError(conn.ws, "INVALID_MATCH", "Match not found", false);
    return;
  }
  if (match.phase !== "loading") return;

  match.loadedFlags[conn.matchSlot] = true;

  if (match.loadedFlags[0] && match.loadedFlags[1]) {
    startCountdown(match);
  }
}

export function handleRaceInput(
  conn: Connection,
  event: typeof RaceInputEvent._type
): void {
  if (!conn.matchId || conn.matchSlot === null) return;
  const match = getMatch(conn.matchId);
  if (!match || match.phase !== "racing") return;
  if (match.matchId !== event.matchId) return;

  const slot = conn.matchSlot;

  // 중복/역순 seq 폐기 (기능정의서 13.2절)
  if (event.seq <= match.lastSeqs[slot]) return;
  match.lastSeqs[slot] = event.seq;

  // 입력 판정
  match.judgeStates[slot] = applyInput(
    match.judgeStates[slot],
    match.promptText,
    event.kind,
    event.value
  );

  const myState = match.judgeStates[slot];
  const elapsed = match.startedAt ? Date.now() - match.startedAt : 0;

  // progress/WPM/accuracy 계산
  const progress = myState.correctChars / match.promptText.length;
  const elapsedMin = elapsed / 60000;
  const wpm =
    elapsedMin > 0 ? myState.correctChars / CHARS_PER_WORD / elapsedMin : 0;
  const total = myState.correctChars + myState.incorrectKeystrokes;
  const accuracy = total > 0 ? (myState.correctChars / total) * 100 : 100;

  const oppSlot = (1 - slot) as 0 | 1;
  const oppState = match.judgeStates[oppSlot];
  const oppProgress = oppState.correctChars / match.promptText.length;
  const oppTotal = oppState.correctChars + oppState.incorrectKeystrokes;
  const oppWpm =
    elapsedMin > 0 ? oppState.correctChars / CHARS_PER_WORD / elapsedMin : 0;

  // 양쪽에 progress 브로드캐스트
  // 각 플레이어에게 self/opponent 기준으로 전송
  for (let s = 0; s <= 1; s++) {
    const c = match.connections[s];
    if (!c?.ws) continue;
    const isSelf = s === slot;
    sendRaw(c.ws, {
      type: "race.progress",
      matchId: match.matchId,
      selfProgress: isSelf ? progress : oppProgress,
      selfWpm: isSelf ? wpm : oppWpm,
      selfAccuracy: isSelf
        ? accuracy
        : oppTotal > 0
        ? (oppState.correctChars / oppTotal) * 100
        : 100,
      opponentProgress: isSelf ? oppProgress : progress,
      opponentWpm: isSelf ? oppWpm : wpm,
    } as RaceProgressEvent);
  }

  // 완료 체크
  if (myState.finished) {
    const finishMs = elapsed;
    match.finishMs[slot] = finishMs;

    if (match.phase === "racing") {
      match.phase = "finish_wait";
      // 상대가 완료하거나 타임아웃까지 대기 (타임아웃 타이머는 그대로 유지)
    } else if (match.phase === "finish_wait") {
      // 두 번째 완료
      finalizeMatch(match, slot, "completion");
    }
  }
}

export function handleRaceLeave(
  conn: Connection,
  event: typeof RaceLeaveEvent._type
): void {
  if (!conn.matchId || conn.matchSlot === null) return;
  const match = getMatch(conn.matchId);
  if (!match) return;

  const oppSlot = (1 - conn.matchSlot) as 0 | 1;
  broadcastToMatch(match.connections, {
    type: "opponent.presence",
    status: "forfeited",
  });
  finalizeMatch(match, oppSlot, "forfeit");
}

// ─── 내부 함수 ────────────────────────────────────────────────────────

export function startCountdown(match: LiveMatch): void {
  match.phase = "countdown";
  const serverStartAt = Date.now() + COUNTDOWN_MS;

  broadcastToMatch(match.connections, {
    type: "countdown.start",
    serverStartAt,
  } as CountdownStartEvent);

  match.countdownTimer = setTimeout(() => {
    startRacing(match);
  }, COUNTDOWN_MS);
}

function startRacing(match: LiveMatch): void {
  match.phase = "racing";
  match.startedAt = Date.now();

  // 120초 타임아웃 (기능정의서 5.3절)
  match.raceTimer = setTimeout(() => {
    handleTimeout(match);
  }, MATCH_TIMEOUT_MS);
}

function handleTimeout(match: LiveMatch): void {
  if (match.phase === "completed" || match.phase === "aborted") return;

  // 더 높은 progress 기준으로 winner 결정 (기능정의서 5.3절 tie-breaker)
  const p0 = match.judgeStates[0].correctChars;
  const p1 = match.judgeStates[1].correctChars;

  let winnerSlot: 0 | 1 | null = null;
  if (p0 > p1) winnerSlot = 0;
  else if (p1 > p0) winnerSlot = 1;
  // p0 === p1 → draw

  finalizeMatch(match, winnerSlot, "timeout");
}

async function finalizeMatch(
  match: LiveMatch,
  winnerSlot: 0 | 1 | null,
  outcomeType: "completion" | "timeout" | "forfeit"
): Promise<void> {
  if (match.phase === "completed" || match.phase === "aborted") return;
  match.phase = "completed";

  // 타이머 정리
  if (match.raceTimer) clearTimeout(match.raceTimer);
  if (match.countdownTimer) clearTimeout(match.countdownTimer);

  const elapsed = match.startedAt ? Date.now() - match.startedAt : 0;
  const elapsedMin = elapsed / 60000;

  const getStats = (slot: 0 | 1) => {
    const js = match.judgeStates[slot];
    const total = js.correctChars + js.incorrectKeystrokes;
    const wpm =
      elapsedMin > 0 ? js.correctChars / CHARS_PER_WORD / elapsedMin : 0;
    const accuracy = total > 0 ? (js.correctChars / total) * 100 : 100;
    return {
      wpm,
      accuracy,
      finishMs: match.finishMs[slot],
      correctChars: js.correctChars,
    };
  };

  const stats0 = getStats(0);
  const stats1 = getStats(1);

  // DB 저장
  try {
    const dbMatch = await prisma.match.create({
      data: {
        mode: "ranked",
        promptId: match.promptId,
        state: "completed",
        startedAt: match.startedAt ? new Date(match.startedAt) : undefined,
        endedAt: new Date(),
        outcomeType,
        winnerParticipantId:
          winnerSlot !== null ? match.participantIds[winnerSlot] : undefined,
      },
    });

    await prisma.matchParticipant.createMany({
      data: [
        {
          matchId: dbMatch.id,
          participantType: "user",
          participantId: match.participantIds[0],
          slot: 0,
          finishMs: stats0.finishMs,
          correctChars: stats0.correctChars,
          totalKeystrokes: match.judgeStates[0].totalKeystrokes,
          accuracy: stats0.accuracy,
          wpm: stats0.wpm,
        },
        {
          matchId: dbMatch.id,
          participantType: "user",
          participantId: match.participantIds[1],
          slot: 1,
          finishMs: stats1.finishMs,
          correctChars: stats1.correctChars,
          totalKeystrokes: match.judgeStates[1].totalKeystrokes,
          accuracy: stats1.accuracy,
          wpm: stats1.wpm,
        },
      ],
    });
  } catch (err) {
    console.error("Failed to save match result:", err);
    // 저장 실패해도 결과는 클라이언트에 전송
  }

  // race.result 이벤트 전송
  for (let s = 0; s <= 1; s++) {
    const c = match.connections[s];
    if (!c?.ws) continue;

    const mySlot = s as 0 | 1;
    const oppSlot = (1 - mySlot) as 0 | 1;
    const myStats = mySlot === 0 ? stats0 : stats1;
    const oppStats = mySlot === 0 ? stats1 : stats0;

    let outcome: "win" | "loss" | "draw" | "forfeit" | "no_result";
    if (outcomeType === "forfeit") {
      outcome = winnerSlot === mySlot ? "win" : "forfeit";
    } else if (winnerSlot === null) {
      outcome = "draw";
    } else {
      outcome = winnerSlot === mySlot ? "win" : "loss";
    }

    sendRaw(c.ws, {
      type: "race.result",
      matchId: match.matchId,
      outcome,
      myStats: {
        wpm: myStats.wpm,
        accuracy: myStats.accuracy,
        finishMs: myStats.finishMs,
        correctChars: myStats.correctChars,
      },
      opponentStats: {
        wpm: oppStats.wpm,
        accuracy: oppStats.accuracy,
        finishMs: oppStats.finishMs,
      },
    } as RaceResultEvent);

    // 연결 상태 초기화
    if (c) {
      c.matchId = null;
      c.matchSlot = null;
    }
  }

  deleteMatch(match.matchId);
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/ws-server/src/handlers/race.ts
git commit -m "Race 핸들러: match.loaded→countdown→race.input→결과 저장→race.result"
```

---

## Task 9: WS 클라이언트 래퍼 + match-store

**Files:**

- Create: `apps/web/lib/ws-client.ts`
- Create: `apps/web/lib/stores/match-store.ts`

- [ ] **Step 1: ws-client.ts 작성**

단일 WS 연결을 유지하며 자동 재연결하는 래퍼. 이벤트는 Zustand store로 디스패치.

```ts
// apps/web/lib/ws-client.ts
"use client";
import { ServerEvent } from "@type-arena/shared";

type EventHandler = (event: ServerEvent) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(token: string): void {
    this.token = token;
    this.shouldConnect = true;
    this.reconnectDelay = 1000;
    this.open();
  }

  disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }

  send(event: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private open(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      // 연결 즉시 session.auth 전송
      if (this.token) {
        this.send({ type: "session.auth", token: this.token });
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as ServerEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        console.error("WS parse error", e.data);
      }
    };

    this.ws.onclose = () => {
      if (!this.shouldConnect) return;
      // 지수 백오프 재연결 (최대 10초)
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
        this.open();
      }, this.reconnectDelay);
    };

    this.ws.onerror = (err) => {
      console.error("WS error", err);
    };
  }
}

// 싱글턴 — 탭당 하나의 WS 연결
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8081";
export const wsClient = new WsClient(WS_URL);
```

- [ ] **Step 2: match-store.ts 작성**

```ts
// apps/web/lib/stores/match-store.ts
"use client";
import { create } from "zustand";
import {
  ServerEvent,
  RaceResultEvent,
  MatchAssignedEvent,
  RaceProgressEvent,
} from "@type-arena/shared";
import { wsClient } from "@/lib/ws-client";

export type MatchPhase =
  | "idle" // WS 연결 전
  | "connecting" // WS 연결 중
  | "authenticated" // session.ok 받음
  | "queuing" // queue.join 전송 후
  | "loading" // match.assigned 받음, match.loaded 전송 후
  | "countdown" // countdown.start 받음
  | "racing" // 레이스 진행 중
  | "finished"; // race.result 받음

interface MatchState {
  phase: MatchPhase;
  matchId: string | null;
  promptText: string;
  promptId: string;
  slot: 0 | 1 | null;
  opponentNickname: string;

  // 실시간 통계 (서버 확정값)
  selfProgress: number;
  selfWpm: number;
  selfAccuracy: number;
  opponentProgress: number;
  opponentWpm: number;

  // 서버 시작 시각 (카운트다운)
  serverStartAt: number | null;

  // 결과
  result: RaceResultEvent | null;

  // Actions
  connectAndAuth: (token: string) => void;
  joinQueue: () => void;
  sendLoaded: (matchId: string) => void;
  sendInput: (
    matchId: string,
    seq: number,
    kind: "type" | "backspace",
    value?: string
  ) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  phase: "idle",
  matchId: null,
  promptText: "",
  promptId: "",
  slot: null,
  opponentNickname: "",
  selfProgress: 0,
  selfWpm: 0,
  selfAccuracy: 0,
  opponentProgress: 0,
  opponentWpm: 0,
  serverStartAt: null,
  result: null,

  connectAndAuth: (token) => {
    set({ phase: "connecting" });

    wsClient.connect(token);

    // WS 이벤트 → store 상태 매핑
    wsClient.on((event: ServerEvent) => {
      switch (event.type) {
        case "session.ok":
          set({ phase: "authenticated" });
          break;

        case "queue.status":
          if (event.state === "queuing") set({ phase: "queuing" });
          break;

        case "match.assigned": {
          const e = event as MatchAssignedEvent;
          set({
            phase: "loading",
            matchId: e.matchId,
            promptText: e.promptText,
            promptId: e.promptId,
            slot: e.slot,
            opponentNickname: e.opponentNickname,
          });
          // match.loaded 즉시 전송
          get().sendLoaded(e.matchId);
          break;
        }

        case "countdown.start":
          set({ phase: "countdown", serverStartAt: event.serverStartAt });
          break;

        case "race.progress": {
          const e = event as RaceProgressEvent;
          set({
            phase: "racing",
            selfProgress: e.selfProgress,
            selfWpm: e.selfWpm,
            selfAccuracy: e.selfAccuracy,
            opponentProgress: e.opponentProgress,
            opponentWpm: e.opponentWpm,
          });
          break;
        }

        case "race.result":
          set({ phase: "finished", result: event as RaceResultEvent });
          break;

        case "error":
          console.error("WS error:", event.code, event.message);
          break;
      }
    });
  },

  joinQueue: () => {
    wsClient.send({ type: "queue.join", mode: "ranked" });
    set({ phase: "queuing" });
  },

  sendLoaded: (matchId) => {
    wsClient.send({ type: "match.loaded", matchId });
  },

  sendInput: (matchId, seq, kind, value) => {
    wsClient.send({ type: "race.input", matchId, seq, kind, value });
  },

  reset: () => {
    wsClient.disconnect();
    set({
      phase: "idle",
      matchId: null,
      promptText: "",
      promptId: "",
      slot: null,
      opponentNickname: "",
      selfProgress: 0,
      selfWpm: 0,
      selfAccuracy: 0,
      opponentProgress: 0,
      opponentWpm: 0,
      serverStartAt: null,
      result: null,
    });
  },
}));
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/lib/ws-client.ts apps/web/lib/stores/match-store.ts
git commit -m "WS 클라이언트 래퍼 + match-store: 자동 재연결 + 이벤트 상태 매핑"
```

---

## Task 10: SCR-03 Ranked Queue + WS 기반 Race/Result 화면

**Files:**

- Create: `apps/web/app/ranked/page.tsx`
- Create: `apps/web/app/match/[id]/race/page.tsx`
- Create: `apps/web/app/match/[id]/result/page.tsx`
- Create: `apps/web/components/race/opponent-progress.tsx`

- [ ] **Step 1: opponent-progress.tsx 작성**

```tsx
// apps/web/components/race/opponent-progress.tsx
"use client";

interface OpponentProgressProps {
  progress: number; // 0~1
  wpm: number;
  nickname: string;
}

export function OpponentProgress({
  progress,
  wpm,
  nickname,
}: OpponentProgressProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{nickname}</span>
        <span>{Math.round(wpm)} WPM</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="bg-rose-500 h-2 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: SCR-03 Ranked Queue 페이지 작성**

```tsx
// apps/web/app/ranked/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMatchStore } from "@/lib/stores/match-store";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RankedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { phase, matchId, connectAndAuth, joinQueue, reset } = useMatchStore();

  // 로그인 확인
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  // WS 연결 및 큐 진입
  useEffect(() => {
    if (status !== "authenticated" || phase !== "idle") return;

    async function initWs() {
      try {
        const res = await fetch("/api/v1/auth/ws-token");
        if (!res.ok) throw new Error("Token fetch failed");
        const { token } = (await res.json()) as { token: string };
        connectAndAuth(token);
      } catch (err) {
        console.error("WS init failed:", err);
      }
    }

    initWs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // authenticated 상태가 되면 자동으로 큐 진입
  useEffect(() => {
    if (phase === "authenticated") {
      joinQueue();
    }
  }, [phase, joinQueue]);

  // 매치 배정 시 race 화면으로 이동
  useEffect(() => {
    if (phase === "loading" && matchId) {
      router.push(`/match/${matchId}/race`);
    }
  }, [phase, matchId, router]);

  const handleCancel = () => {
    reset();
    router.push("/");
  };

  if (status === "loading" || phase === "idle" || phase === "connecting") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-xl">Connecting...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Finding Opponent</h1>
        <p className="text-gray-400">Looking for a ranked match...</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
        </div>
      </div>

      <Button variant="secondary" onClick={handleCancel}>
        Cancel
      </Button>

      <p className="text-gray-600 text-sm">
        Phase 2: Simple FIFO matching — first two players get matched instantly
      </p>
    </main>
  );
}
```

- [ ] **Step 3: WS 기반 Race 화면 작성**

```tsx
// apps/web/app/match/[id]/race/page.tsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMatchStore } from "@/lib/stores/match-store";
import { PromptDisplay } from "@/components/race/prompt-display";
import { ProgressBar } from "@/components/race/progress-bar";
import { OpponentProgress } from "@/components/race/opponent-progress";
import { useRaceStore } from "@/lib/stores/race-store";
import { COUNTDOWN_MS } from "@type-arena/shared";

export default function MatchRacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    phase,
    matchId,
    promptText,
    slot,
    opponentNickname,
    selfProgress,
    selfWpm,
    selfAccuracy,
    opponentProgress,
    opponentWpm,
    serverStartAt,
    sendInput,
  } = useMatchStore();

  // 로컬 race-store는 프롬프트 표시/커서 추적에만 사용 (optimistic)
  const { init, handleKeyPress, startRacing, startCountdown } = useRaceStore();
  const seqRef = useRef(0);

  // 프롬프트 초기화
  useEffect(() => {
    if (promptText && matchId) {
      init(matchId, promptText);
    }
  }, [promptText, matchId, init]);

  // 카운트다운 시작
  useEffect(() => {
    if (phase === "countdown" && serverStartAt) {
      const now = Date.now();
      const remaining = serverStartAt - now;
      startCountdown();
      const timer = setTimeout(() => {
        startRacing();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [phase, serverStartAt, startCountdown, startRacing]);

  // 키보드 입력 캡처 + WS 전송
  useEffect(() => {
    if (phase !== "racing" || !matchId) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.isComposing) return;
      e.preventDefault();

      const kind = e.key === "Backspace" ? "backspace" : "type";
      const value = kind === "type" ? e.key : undefined;
      if (kind === "type" && value?.length !== 1) return;

      seqRef.current += 1;
      sendInput(matchId!, seqRef.current, kind, value);
      handleKeyPress(e.key); // optimistic 로컬 업데이트
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, matchId, sendInput, handleKeyPress]);

  // 결과 화면으로 이동
  useEffect(() => {
    if (phase === "finished" && matchId) {
      router.push(`/match/${matchId}/result`);
    }
  }, [phase, matchId, router]);

  if (!matchId || params.id !== matchId) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading match...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
      {phase === "countdown" && serverStartAt && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
          <CountdownDisplay serverStartAt={serverStartAt} />
        </div>
      )}

      <div className="w-full max-w-3xl space-y-4">
        {/* 내 진행률 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>You</span>
            <span>
              {Math.round(selfWpm)} WPM · {selfAccuracy.toFixed(1)}%
            </span>
          </div>
          <ProgressBar />
        </div>

        {/* 상대 진행률 */}
        <OpponentProgress
          progress={opponentProgress}
          wpm={opponentWpm}
          nickname={opponentNickname}
        />

        {/* 프롬프트 */}
        <PromptDisplay />
      </div>
    </main>
  );
}

// 서버 기준 카운트다운 숫자 표시
function CountdownDisplay({ serverStartAt }: { serverStartAt: number }) {
  const remaining = Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000));
  return (
    <span className="text-8xl font-bold text-indigo-400 animate-pulse">
      {remaining > 0 ? remaining : "GO!"}
    </span>
  );
}
```

- [ ] **Step 4: WS 기반 Result 화면 작성**

```tsx
// apps/web/app/match/[id]/result/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMatchStore } from "@/lib/stores/match-store";
import { Button } from "@/components/ui/button";

const outcomeLabel: Record<string, { text: string; color: string }> = {
  win: { text: "Victory!", color: "text-green-400" },
  loss: { text: "Defeat", color: "text-red-400" },
  draw: { text: "Draw", color: "text-yellow-400" },
  forfeit: { text: "Opponent Forfeited", color: "text-indigo-400" },
  no_result: { text: "No Result", color: "text-gray-400" },
};

export default function MatchResultPage() {
  const { result, reset } = useMatchStore();
  const router = useRouter();

  // result가 없으면 (직접 URL 접근 등) 홈으로
  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
  }, [result, router]);

  if (!result) return null;

  const label = outcomeLabel[result.outcome] ?? {
    text: result.outcome,
    color: "text-white",
  };
  const { myStats, opponentStats } = result;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-8">
      <h1 className={`text-5xl font-bold ${label.color}`}>{label.text}</h1>

      <div className="grid grid-cols-2 gap-8 w-full max-w-lg">
        <div className="space-y-3">
          <p className="text-gray-400 text-sm text-center">You</p>
          <StatCard label="WPM" value={Math.round(myStats.wpm).toString()} />
          <StatCard
            label="Accuracy"
            value={`${myStats.accuracy.toFixed(1)}%`}
          />
          <StatCard
            label="Time"
            value={
              myStats.finishMs
                ? `${(myStats.finishMs / 1000).toFixed(1)}s`
                : "—"
            }
          />
        </div>
        <div className="space-y-3">
          <p className="text-gray-400 text-sm text-center">Opponent</p>
          <StatCard
            label="WPM"
            value={Math.round(opponentStats.wpm).toString()}
          />
          <StatCard
            label="Accuracy"
            value={`${opponentStats.accuracy.toFixed(1)}%`}
          />
          <StatCard
            label="Time"
            value={
              opponentStats.finishMs
                ? `${(opponentStats.finishMs / 1000).toFixed(1)}s`
                : "—"
            }
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Link href="/ranked" onClick={reset}>
          <Button>Play Again</Button>
        </Link>
        <Link href="/" onClick={reset}>
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
```

- [ ] **Step 5: 커밋**

```bash
git add apps/web/app/ranked/ apps/web/app/match/ apps/web/components/race/opponent-progress.tsx
git commit -m "SCR-03 Ranked Queue + WS 기반 Race/Result 화면 + 상대 진행률 표시"
```

---

## Task 11: 빌드 확인 + 전체 테스트

**Files:**

- Verify only (no new files)

- [ ] **Step 1: shared 패키지 테스트 통과 확인**

Run: `pnpm --filter @type-arena/shared test`
Expected: 14 tests passed (Phase 1과 동일)

- [ ] **Step 2: WS 서버 테스트 통과 확인**

Run: `pnpm --filter @type-arena/ws-server test`
Expected: input-judge 테스트 통과

- [ ] **Step 3: 전체 빌드 확인**

Run: `pnpm build`
Expected: `@type-arena/shared` + `@type-arena/web` 모두 빌드 성공
(`@type-arena/ws-server`는 `tsc` 로 빌드 — 에러 없어야 함)

빌드 에러 있을 경우: `mcp__ide__getDiagnostics`로 타입 에러 확인 후 수정.

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "Phase 2 완료: Google OAuth + WS 서버 + 서버 권위 1v1 실시간 대결"
```

---

## Phase 2 완료 조건

- [ ] Google OAuth 로그인 후 session.user.id가 DB UserAccount.id와 일치
- [ ] `/api/v1/auth/ws-token` 이 5분 TTL JWT 반환
- [ ] WS 서버 `session.auth` → `session.ok` 정상 동작
- [ ] 두 탭에서 `/ranked` → 큐 진입 → 자동 매칭 → race 화면 진입
- [ ] 서버 권위 입력 판정: `race.input` → `race.progress` 브로드캐스트
- [ ] 경기 완료 시 DB `match` + `match_participant` 레코드 생성
- [ ] `race.result` 수신 후 result 화면 표시 (Win/Loss/Draw)
- [ ] `pnpm build` 성공
- [ ] `pnpm test` (shared + ws-server) 모두 통과

---

## 후속 Phase 요약

- **Phase 3**: 비공개 방 생성/참가/Ready/Start/Rematch + reconnect 처리
- **Phase 4**: Elo RS 매치메이킹 + SeasonRating + Profile + Leaderboard
- **Phase 5**: Vercel + Railway 배포 + 관리자 기능 + 안정화 + 클로즈드 베타 런칭
