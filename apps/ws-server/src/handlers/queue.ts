// apps/ws-server/src/handlers/queue.ts
import { randomUUID } from "crypto";
import { z } from "zod";
import { QueueJoinEvent, QueueLeaveEvent, MatchAssignedEvent } from "@type-arena/shared";
import { Connection, LiveMatch } from "../types";
import { sendRaw, sendError, broadcastToMatch } from "../utils";
import {
  getWaiting,
  setWaiting,
  setMatch,
} from "../connection-store";
import { createJudgeState } from "../engine/input-judge";
import { prisma } from "../services/db";
import { startCountdown } from "./race";

export async function handleQueueJoin(
  conn: Connection,
  _event: z.infer<typeof QueueJoinEvent>
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
  _event: z.infer<typeof QueueLeaveEvent>
): void {
  const waiting = getWaiting();
  if (waiting?.connId === conn.connId) {
    setWaiting(null);
  }
  sendRaw(conn.ws, { type: "queue.status", state: "matched" });
}
