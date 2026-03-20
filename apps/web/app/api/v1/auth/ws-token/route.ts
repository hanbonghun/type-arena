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
