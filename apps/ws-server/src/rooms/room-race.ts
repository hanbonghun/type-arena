// apps/ws-server/src/rooms/room-race.ts
import { z } from "zod";
import {
  RaceInputEvent,
  COUNTDOWN_MS,
  MATCH_TIMEOUT_MS,
  CHARS_PER_WORD,
} from "@type-arena/shared";
import { Connection } from "../types";
import { sendError } from "../utils";
import {
  Room,
  getRoom,
  deleteRoom,
  broadcastToRoom,
  getRoomPlayerPublics,
} from "./room-manager";
import { applyInput } from "../engine/input-judge";

export function startRoomCountdown(room: Room): void {
  room.phase = "countdown";
  const serverStartAt = Date.now() + COUNTDOWN_MS;

  broadcastToRoom(room, {
    type: "room.countdown",
    roomId: room.id,
    serverStartAt,
  });

  room.countdownTimer = setTimeout(() => {
    startRoomRacing(room);
  }, COUNTDOWN_MS);
}

function startRoomRacing(room: Room): void {
  room.phase = "racing";
  room.startedAt = Date.now();

  room.raceTimer = setTimeout(() => {
    finalizeRoom(room, "timeout");
  }, MATCH_TIMEOUT_MS);
}

export function handleRoomInput(
  conn: Connection,
  event: z.infer<typeof RaceInputEvent>
): void {
  if (!conn.roomId || !conn.participantId) return;
  const room = getRoom(conn.roomId);
  if (!room || room.phase !== "racing") return;

  const player = room.players.get(conn.participantId);
  if (!player) return;

  // 중복/역순 seq 폐기
  if (event.seq <= player.lastSeq) return;
  player.lastSeq = event.seq;

  // 입력 판정
  player.judgeState = applyInput(
    player.judgeState,
    room.promptText,
    event.kind,
    event.value
  );

  const elapsed = room.startedAt ? Date.now() - room.startedAt : 0;
  const elapsedMin = elapsed / 60000;

  player.progress = player.judgeState.correctChars / room.promptText.length;
  player.wpm =
    elapsedMin > 0
      ? player.judgeState.correctChars / CHARS_PER_WORD / elapsedMin
      : 0;
  const total =
    player.judgeState.correctChars + player.judgeState.incorrectKeystrokes;
  player.accuracy = total > 0 ? (player.judgeState.correctChars / total) * 100 : 100;

  // 진행도 전체 브로드캐스트
  broadcastToRoom(room, {
    type: "room.progress",
    roomId: room.id,
    players: Array.from(room.players.values()).map((p) => ({
      participantId: p.participantId,
      progress: p.progress,
      wpm: p.wpm,
      accuracy: p.accuracy,
    })),
  });

  // 완주 체크
  if (player.judgeState.finished && player.rank === null) {
    const finishedCount = Array.from(room.players.values()).filter(
      (p) => p.rank !== null
    ).length;
    player.rank = finishedCount + 1;
    player.finishedAt = elapsed;

    // 1등 완주 → 10초 retire 카운트다운 시작
    if (player.rank === 1) {
      startRetireCountdown(room);
    }
  }
}

const RETIRE_MS = 10_000;

function startRetireCountdown(room: Room): void {
  // 기존 120초 타임아웃 취소하고 10초 retire 타이머로 교체
  if (room.raceTimer) clearTimeout(room.raceTimer);

  const retireAt = Date.now() + RETIRE_MS;
  broadcastToRoom(room, {
    type: "room.retiring",
    roomId: room.id,
    retireAt,
  });

  room.raceTimer = setTimeout(() => {
    finalizeRoom(room, "completion");
  }, RETIRE_MS);
}

export function handleRoomDisconnect(conn: Connection): void {
  if (!conn.roomId || !conn.participantId) return;
  const room = getRoom(conn.roomId);
  if (!room) return;

  conn.roomId = null;

  if (room.phase === "lobby") {
    room.players.delete(conn.participantId);

    if (room.players.size === 0) {
      deleteRoom(room.id);
      return;
    }

    // 방장 승계
    if (room.hostId === conn.participantId) {
      room.hostId = room.players.keys().next().value as string;
    }

    // 상태 브로드캐스트 (room-handler 순환 의존 방지: 직접 인라인)
    broadcastToRoom(room, {
      type: "room.state",
      roomId: room.id,
      phase: room.phase,
      hostId: room.hostId,
      players: getRoomPlayerPublics(room),
    });
  }
  // 레이스 중 퇴장: DNF (progress 고정), 나머지 계속 진행
}

function finalizeRoom(room: Room, reason: "completion" | "timeout"): void {
  if (room.phase === "finished") return;
  room.phase = "finished";

  if (room.raceTimer) clearTimeout(room.raceTimer);
  if (room.countdownTimer) clearTimeout(room.countdownTimer);

  const elapsed = room.startedAt ? Date.now() - room.startedAt : 0;
  const elapsedMin = elapsed / 60000;

  // 미완주자 순위 계산
  const players = Array.from(room.players.values());
  const nonFinishers = players
    .filter((p) => p.rank === null)
    .sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      return b.wpm - a.wpm;
    });

  let nextRank =
    players.filter((p) => p.rank !== null).length + 1;
  for (const p of nonFinishers) {
    p.rank = nextRank++;
  }

  const rankings = players
    .sort((a, b) => a.rank! - b.rank!)
    .map((p) => {
      const js = p.judgeState;
      const total = js.correctChars + js.incorrectKeystrokes;
      const wpm =
        elapsedMin > 0 ? js.correctChars / CHARS_PER_WORD / elapsedMin : p.wpm;
      const accuracy =
        total > 0 ? (js.correctChars / total) * 100 : 100;
      return {
        rank: p.rank!,
        participantId: p.participantId,
        nickname: p.nickname,
        wpm,
        accuracy,
        progress: p.progress,
        finishMs: p.finishedAt,
      };
    });

  broadcastToRoom(room, {
    type: "room.finished",
    roomId: room.id,
    rankings,
  });

  // 5분 후 방 삭제
  setTimeout(() => deleteRoom(room.id), 5 * 60 * 1000);
}
