// packages/shared/src/schemas/ws-events.ts
import { z } from "zod";

// ─────────────────── Client → Server (zod 스키마) ───────────────────

export const SessionAuthEvent = z.object({
  type: z.literal("session.auth"),
  token: z.string(), // WS JWT
});

export const QueueJoinEvent = z.object({
  type: z.literal("queue.join"),
  mode: z.literal("ranked"),
});

export const QueueLeaveEvent = z.object({
  type: z.literal("queue.leave"),
  reason: z.string().optional(),
});

export const MatchLoadedEvent = z.object({
  type: z.literal("match.loaded"),
  matchId: z.string(),
});

export const RaceInputEvent = z.object({
  type: z.literal("race.input"),
  matchId: z.string(),
  seq: z.number().int().nonnegative(),
  kind: z.enum(["type", "backspace"]),
  value: z.string().max(1).optional(), // 단일 문자 (kind="type" 시에만)
});

export const RaceLeaveEvent = z.object({
  type: z.literal("race.leave"),
  matchId: z.string(),
  reason: z.string().optional(),
});

export const PingEvent = z.object({
  type: z.literal("ping"),
  clientTs: z.number(),
});

export const ClientEvent = z.discriminatedUnion("type", [
  SessionAuthEvent,
  QueueJoinEvent,
  QueueLeaveEvent,
  MatchLoadedEvent,
  RaceInputEvent,
  RaceLeaveEvent,
  PingEvent,
]);
export type ClientEvent = z.infer<typeof ClientEvent>;

// ─────────────────── Server → Client (TypeScript 인터페이스) ───────────────────

export interface SessionOkEvent {
  type: "session.ok";
  participantId: string;
  participantType: "user" | "guest";
  nickname: string;
}

export interface QueueStatusEvent {
  type: "queue.status";
  state: "queuing" | "matched" | "timeout";
  estimatedWait?: number;
}

export interface MatchAssignedEvent {
  type: "match.assigned";
  matchId: string;
  promptText: string;
  promptId: string;
  checksum: string;
  opponentNickname: string;
  slot: 0 | 1;
}

export interface CountdownStartEvent {
  type: "countdown.start";
  serverStartAt: number; // Unix timestamp ms — 클라이언트는 이 시각 기준으로 카운트다운 표시
}

export interface RaceProgressEvent {
  type: "race.progress";
  matchId: string;
  selfProgress: number;      // 0~1
  selfWpm: number;
  selfAccuracy: number;      // 0~100
  opponentProgress: number;  // 0~1
  opponentWpm: number;
}

export interface OpponentPresenceEvent {
  type: "opponent.presence";
  status: "connected" | "reconnecting" | "forfeited";
}

export interface RaceResultEvent {
  type: "race.result";
  matchId: string;
  outcome: "win" | "loss" | "draw" | "forfeit" | "no_result";
  myStats: {
    wpm: number;
    accuracy: number;
    finishMs: number | null;
    correctChars: number;
  };
  opponentStats: {
    wpm: number;
    accuracy: number;
    finishMs: number | null;
  };
}

export interface PongEvent {
  type: "pong";
  serverTs: number;
}

export interface WsErrorEvent {
  type: "error";
  code: string;
  message: string;
  retryable: boolean;
}

export type ServerEvent =
  | SessionOkEvent
  | QueueStatusEvent
  | MatchAssignedEvent
  | CountdownStartEvent
  | RaceProgressEvent
  | OpponentPresenceEvent
  | RaceResultEvent
  | PongEvent
  | WsErrorEvent;
