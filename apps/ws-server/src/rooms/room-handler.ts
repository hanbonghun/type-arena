// apps/ws-server/src/rooms/room-handler.ts
import { z } from "zod";
import {
  RoomCreateEvent,
  RoomJoinEvent,
  RoomReadyEvent,
  RoomStartEvent,
} from "@type-arena/shared";
import { Connection } from "../types";
import { sendRaw, sendError } from "../utils";
import {
  Room,
  createRoom,
  getRoom,
  getRoomByCode,
  broadcastToRoom,
  getRoomPlayerPublics,
  RoomPlayer,
} from "./room-manager";
import { broadcastToAll } from "./room-manager";
import { createJudgeState } from "../engine/input-judge";
import { startRoomCountdown } from "./room-race";
import { prisma } from "../services/db";

export async function handleRoomCreate(
  conn: Connection,
  _event: z.infer<typeof RoomCreateEvent>
): Promise<void> {
  if (!conn.participantId || !conn.nickname) {
    sendError(conn.ws, "NOT_AUTHENTICATED", "Authenticate first", false);
    return;
  }
  if (conn.roomId) {
    sendError(conn.ws, "ALREADY_IN_ROOM", "Leave current room first", false);
    return;
  }

  const count = await prisma.promptCatalog.count({ where: { active: true } });
  if (count === 0) {
    sendError(conn.ws, "NO_PROMPTS", "No prompts available", false);
    return;
  }
  const skip = Math.floor(Math.random() * count);
  const prompt = await prisma.promptCatalog.findFirst({
    where: { active: true },
    skip,
  });
  if (!prompt) {
    sendError(conn.ws, "NO_PROMPTS", "No prompts available", false);
    return;
  }

  const room = createRoom(
    conn.participantId,
    conn.nickname,
    conn.ws,
    prompt.id,
    prompt.normalizedText,
    createJudgeState()
  );
  conn.roomId = room.id;

  sendRaw(conn.ws, {
    type: "room.created",
    roomId: room.id,
    roomCode: room.code,
    promptText: room.promptText,
  });
}

export async function handleRoomJoin(
  conn: Connection,
  event: z.infer<typeof RoomJoinEvent>
): Promise<void> {
  if (!conn.participantId || !conn.nickname) {
    sendError(conn.ws, "NOT_AUTHENTICATED", "Authenticate first", false);
    return;
  }
  if (conn.roomId) {
    sendError(conn.ws, "ALREADY_IN_ROOM", "Leave current room first", false);
    return;
  }

  const room = getRoomByCode(event.roomCode);
  if (!room) {
    sendError(conn.ws, "ROOM_NOT_FOUND", "Room not found", false);
    return;
  }

  // capacity: max 4 total (active + waiting)
  const totalPlayers = room.players.size + room.waitingPlayers.size;
  if (totalPlayers >= 4) {
    sendError(conn.ws, "ROOM_FULL", "Room is full (max 4 players)", false);
    return;
  }

  const newPlayer: RoomPlayer = {
    participantId: conn.participantId,
    nickname: conn.nickname,
    ws: conn.ws,
    ready: false,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    rank: null,
    finishedAt: null,
    judgeState: createJudgeState(),
    lastSeq: -1,
  };

  // 게임 진행 중 (countdown/racing/finished) → 대기열에 추가
  if (room.phase !== "lobby") {
    room.waitingPlayers.set(conn.participantId, newPlayer);
    conn.roomId = room.id;

    sendRaw(conn.ws, {
      type: "room.joined",
      roomId: room.id,
      roomCode: room.code,
      promptText: room.promptText,
      hostId: room.hostId,
      myParticipantId: conn.participantId,
      players: getRoomPlayerPublics(room),
      isWaiting: true,
    });

    // 기존 플레이어에게 대기자 추가 알림
    broadcastToAll(room, {
      type: "room.state",
      roomId: room.id,
      phase: room.phase,
      hostId: room.hostId,
      players: getRoomPlayerPublics(room),
    });
    return;
  }

  room.players.set(conn.participantId, newPlayer);
  conn.roomId = room.id;

  // 입장 플레이어에게 전체 상태 전송
  sendRaw(conn.ws, {
    type: "room.joined",
    roomId: room.id,
    roomCode: room.code,
    promptText: room.promptText,
    hostId: room.hostId,
    myParticipantId: conn.participantId,
    players: getRoomPlayerPublics(room),
  });

  // 기존 플레이어에게 상태 업데이트
  broadcastRoomState(room);
}

export function handleRoomReady(
  conn: Connection,
  event: z.infer<typeof RoomReadyEvent>
): void {
  if (!conn.roomId || conn.roomId !== event.roomId) {
    sendError(conn.ws, "NOT_IN_ROOM", "Not in this room", false);
    return;
  }
  const room = getRoom(event.roomId);
  if (!room || room.phase !== "lobby") return;

  const player = room.players.get(conn.participantId!);
  if (!player) return;

  player.ready = !player.ready;
  broadcastRoomState(room);

  // 모든 플레이어가 레디 상태이고 2명 이상이면 자동 시작
  const activePlayers = Array.from(room.players.values());
  if (activePlayers.length >= 2 && activePlayers.every((p) => p.ready)) {
    startRoomCountdown(room);
  }
}

export function handleRoomStart(
  conn: Connection,
  event: z.infer<typeof RoomStartEvent>
): void {
  if (!conn.roomId || conn.roomId !== event.roomId) {
    sendError(conn.ws, "NOT_IN_ROOM", "Not in this room", false);
    return;
  }
  const room = getRoom(event.roomId);
  if (!room || room.phase !== "lobby") return;

  if (room.hostId !== conn.participantId) {
    sendError(conn.ws, "NOT_HOST", "Only host can start the game", false);
    return;
  }
  if (room.players.size < 2) {
    sendError(conn.ws, "NOT_ENOUGH_PLAYERS", "Need at least 2 players", false);
    return;
  }
  for (const player of room.players.values()) {
    if (!player.ready) {
      sendError(conn.ws, "NOT_ALL_READY", "All players must be ready first", false);
      return;
    }
  }

  startRoomCountdown(room);
}

export function broadcastRoomState(room: Room): void {
  broadcastToRoom(room, {
    type: "room.state",
    roomId: room.id,
    phase: room.phase,
    hostId: room.hostId,
    players: getRoomPlayerPublics(room),
  });
}
