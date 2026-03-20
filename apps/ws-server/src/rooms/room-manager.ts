// apps/ws-server/src/rooms/room-manager.ts
import { randomBytes } from "crypto";
import { WebSocket } from "ws";
import { ServerEvent } from "@type-arena/shared";
import { JudgeState } from "../engine/input-judge";

export interface RoomPlayer {
  participantId: string;
  nickname: string;
  ws: WebSocket;
  ready: boolean;
  progress: number;
  wpm: number;
  accuracy: number;
  rank: number | null;
  finishedAt: number | null;
  judgeState: JudgeState;
  lastSeq: number;
}

export type RoomPhase = "lobby" | "countdown" | "racing" | "finished";

export interface Room {
  id: string;
  code: string;
  hostId: string;
  phase: RoomPhase;
  promptId: string;
  promptText: string;
  players: Map<string, RoomPlayer>;
  createdAt: number;
  startedAt: number | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  raceTimer: ReturnType<typeof setTimeout> | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();
const codeToId = new Map<string, string>();

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function createRoom(
  hostId: string,
  hostNickname: string,
  hostWs: WebSocket,
  promptId: string,
  promptText: string,
  initialJudgeState: JudgeState
): Room {
  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    attempts++;
    if (attempts > 5) throw new Error("Failed to generate unique room code");
  } while (codeToId.has(code));

  const id = randomBytes(8).toString("hex");

  const hostPlayer: RoomPlayer = {
    participantId: hostId,
    nickname: hostNickname,
    ws: hostWs,
    ready: false,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    rank: null,
    finishedAt: null,
    judgeState: initialJudgeState,
    lastSeq: -1,
  };

  const room: Room = {
    id,
    code,
    hostId,
    phase: "lobby",
    promptId,
    promptText,
    players: new Map([[hostId, hostPlayer]]),
    createdAt: Date.now(),
    startedAt: null,
    countdownTimer: null,
    raceTimer: null,
    expiryTimer: null,
  };

  // 10분 미시작 시 만료
  room.expiryTimer = setTimeout(() => {
    if (room.phase === "lobby") deleteRoom(id);
  }, 10 * 60 * 1000);

  rooms.set(id, room);
  codeToId.set(code, id);
  return room;
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function getRoomByCode(code: string): Room | undefined {
  const id = codeToId.get(code.toUpperCase());
  return id ? rooms.get(id) : undefined;
}

export function deleteRoom(id: string): void {
  const room = rooms.get(id);
  if (!room) return;
  if (room.expiryTimer) clearTimeout(room.expiryTimer);
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  if (room.raceTimer) clearTimeout(room.raceTimer);
  codeToId.delete(room.code);
  rooms.delete(id);
}

export function broadcastToRoom(room: Room, event: ServerEvent): void {
  const msg = JSON.stringify(event);
  for (const player of room.players.values()) {
    if (player.ws.readyState === 1 /* OPEN */) {
      player.ws.send(msg);
    }
  }
}

export function getRoomPlayerPublics(room: Room) {
  return Array.from(room.players.values()).map((p) => ({
    participantId: p.participantId,
    nickname: p.nickname,
    ready: p.ready,
    isHost: p.participantId === room.hostId,
  }));
}
