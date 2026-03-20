// apps/web/app/api/v1/guest-sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

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

  const token = jwt.sign(
    { sub: session.id, type: "guest", nickname: session.nickname },
    process.env.WS_JWT_SECRET!,
    { expiresIn: "24h" }
  );

  return NextResponse.json({
    id: session.id,
    nickname: session.nickname,
    token,
    expiresAt: session.expiresAt.toISOString(),
  });
}
