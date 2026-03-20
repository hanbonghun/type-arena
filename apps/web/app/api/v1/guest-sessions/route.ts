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
