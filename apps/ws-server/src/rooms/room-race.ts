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
  RoomPlayer,
  getRoom,
  deleteRoom,
  broadcastToRoom,
  broadcastToAll,
  getRoomPlayerPublics,
} from "./room-manager";
import { applyInput, createJudgeState } from "../engine/input-judge";
import { prisma } from "../services/db";

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

  // 진행도 전체 브로드캐스트 (대기자 포함 — 관전 가능)
  broadcastToAll(room, {
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
  broadcastToAll(room, {
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

  // 대기 중인 플레이어 퇴장
  if (room.waitingPlayers.has(conn.participantId)) {
    room.waitingPlayers.delete(conn.participantId);
    broadcastToAll(room, {
      type: "room.state",
      roomId: room.id,
      phase: room.phase,
      hostId: room.hostId,
      players: getRoomPlayerPublics(room),
    });
    return;
  }

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

  let nextRank = players.filter((p) => p.rank !== null).length + 1;
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
      const accuracy = total > 0 ? (js.correctChars / total) * 100 : 100;
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

  // 대기자 포함 전체에게 결과 전송
  broadcastToAll(room, {
    type: "room.finished",
    roomId: room.id,
    rankings,
  });

  // 8초 후 로비로 리셋 (결과 화면 확인 시간)
  setTimeout(() => resetRoomToLobby(room).catch(console.error), 8_000);
}

const RESET_EXPIRY_MS = 10 * 60 * 1000;

async function resetRoomToLobby(room: Room): Promise<void> {
  // 이미 다른 상태로 바뀐 경우 무시
  if (room.phase !== "finished") return;

  // 새 프롬프트 가져오기
  const count = await prisma.promptCatalog.count({ where: { active: true } });
  if (count === 0) {
    deleteRoom(room.id);
    return;
  }
  const skip = Math.floor(Math.random() * count);
  const prompt = await prisma.promptCatalog.findFirst({ where: { active: true }, skip });
  if (!prompt) {
    deleteRoom(room.id);
    return;
  }

  // 대기자 → 활성 플레이어로 합류
  const merged = new Map<string, RoomPlayer>();
  for (const [id, p] of room.players) {
    merged.set(id, resetPlayerState(p));
  }
  for (const [id, p] of room.waitingPlayers) {
    merged.set(id, resetPlayerState(p));
  }

  room.players = merged;
  room.waitingPlayers = new Map();
  room.phase = "lobby";
  room.promptId = prompt.id;
  room.promptText = prompt.normalizedText;
  room.startedAt = null;

  // 만료 타이머 재설정
  if (room.expiryTimer) clearTimeout(room.expiryTimer);
  room.expiryTimer = setTimeout(() => {
    if (room.phase === "lobby") deleteRoom(room.id);
  }, RESET_EXPIRY_MS);

  broadcastToRoom(room, {
    type: "room.reset",
    roomId: room.id,
    roomCode: room.code,
    promptText: room.promptText,
    hostId: room.hostId,
    players: getRoomPlayerPublics(room),
  });
}

function resetPlayerState(p: RoomPlayer): RoomPlayer {
  return {
    ...p,
    ready: false,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    rank: null,
    finishedAt: null,
    judgeState: createJudgeState(),
    lastSeq: -1,
  };
}
