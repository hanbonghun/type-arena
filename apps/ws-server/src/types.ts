// apps/ws-server/src/types.ts
import { WebSocket } from "ws";
import { JudgeState } from "./engine/input-judge";

export interface Connection {
  connId: string;
  ws: WebSocket;
  participantId: string | null;
  participantType: "user" | "guest" | null;
  nickname: string | null;
  matchId: string | null;
  matchSlot: 0 | 1 | null;
  authenticated: boolean;
}

export type MatchPhase =
  | "loading"
  | "countdown"
  | "racing"
  | "finish_wait"
  | "completed"
  | "aborted";

export interface LiveMatch {
  matchId: string;
  promptText: string;
  promptId: string;
  promptChecksum: string;
  // slot 0 = 먼저 들어온 플레이어, slot 1 = 두 번째
  connections: [Connection | null, Connection | null];
  nicknames: [string, string];
  participantIds: [string, string];
  judgeStates: [JudgeState, JudgeState];
  lastSeqs: [number, number];
  loadedFlags: [boolean, boolean];
  phase: MatchPhase;
  startedAt: number | null;
  finishMs: [number | null, number | null];
  raceTimer: ReturnType<typeof setTimeout> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
}
