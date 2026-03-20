// apps/ws-server/src/handlers/session.ts
// placeholder — will be filled in Task 5
import { Connection } from "../types";
import { z } from "zod";
import { SessionAuthEvent, PingEvent } from "@type-arena/shared";

export function handleSessionAuth(
  conn: Connection,
  event: z.infer<typeof SessionAuthEvent>
): void {
  void conn;
  void event;
}

export function handlePing(
  conn: Connection,
  event: z.infer<typeof PingEvent>
): void {
  void conn;
  void event;
}
