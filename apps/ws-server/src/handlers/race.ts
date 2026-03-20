// apps/ws-server/src/handlers/race.ts
import { z } from "zod";
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
  if (!match || match.phase === "completed" || match.phase === "aborted") return;

  // 경기 중 연결 끊김 → forfeit 처리
  broadcastToMatch(match.connections, {
    type: "opponent.presence",
    status: "forfeited",
  });

  const opponentSlot = (1 - conn.matchSlot) as 0 | 1;
  finalizeMatch(match, opponentSlot, "forfeit");
}

// ─── 핸들러 ───────────────────────────────────────────────────────────

export function handleMatchLoaded(
  conn: Connection,
  event: z.infer<typeof MatchLoadedEvent>
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
  event: z.infer<typeof RaceInputEvent>
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
  const wpm = elapsedMin > 0 ? (myState.correctChars / CHARS_PER_WORD) / elapsedMin : 0;
  const total = myState.correctChars + myState.incorrectKeystrokes;
  const accuracy = total > 0 ? (myState.correctChars / total) * 100 : 100;

  const oppSlot = (1 - slot) as 0 | 1;
  const oppState = match.judgeStates[oppSlot];
  const oppProgress = oppState.correctChars / match.promptText.length;
  const oppTotal = oppState.correctChars + oppState.incorrectKeystrokes;
  const oppWpm = elapsedMin > 0 ? (oppState.correctChars / CHARS_PER_WORD) / elapsedMin : 0;

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
      selfAccuracy: isSelf ? accuracy : (oppTotal > 0 ? (oppState.correctChars / oppTotal) * 100 : 100),
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
      // 상대가 완료하거나 타임아웃까지 대기
    } else if (match.phase === "finish_wait") {
      // 두 번째 완료
      finalizeMatch(match, slot, "completion");
    }
  }
}

export function handleRaceLeave(
  conn: Connection,
  event: z.infer<typeof RaceLeaveEvent>
): void {
  void event;
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

  // 더 높은 progress 기준으로 winner 결정
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
    const wpm = elapsedMin > 0 ? (js.correctChars / CHARS_PER_WORD) / elapsedMin : 0;
    const accuracy = total > 0 ? (js.correctChars / total) * 100 : 100;
    return { wpm, accuracy, finishMs: match.finishMs[slot], correctChars: js.correctChars };
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
        winnerParticipantId: winnerSlot !== null ? match.participantIds[winnerSlot] : undefined,
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
