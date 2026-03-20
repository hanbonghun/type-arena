// apps/ws-server/src/handlers/race.ts
// placeholder — will be filled in Task 8
import { Connection } from "../types";
import { z } from "zod";
import { MatchLoadedEvent, RaceInputEvent, RaceLeaveEvent } from "@type-arena/shared";

export function handleDisconnect(conn: Connection): void {
  void conn;
}

export function handleMatchLoaded(
  conn: Connection,
  event: z.infer<typeof MatchLoadedEvent>
): void {
  void conn;
  void event;
}

export function handleRaceInput(
  conn: Connection,
  event: z.infer<typeof RaceInputEvent>
): void {
  void conn;
  void event;
}

export function handleRaceLeave(
  conn: Connection,
  event: z.infer<typeof RaceLeaveEvent>
): void {
  void conn;
  void event;
}

export function startCountdown(_match: unknown): void {
  void _match;
}
