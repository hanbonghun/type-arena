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
