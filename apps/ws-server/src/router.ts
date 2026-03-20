// apps/ws-server/src/router.ts
import { ClientEvent } from "@type-arena/shared";
import { Connection } from "./types";
import { sendError } from "./utils";
import { handleSessionAuth, handlePing } from "./handlers/session";
import { handleQueueJoin, handleQueueLeave } from "./handlers/queue";
import { handleMatchLoaded, handleRaceInput, handleRaceLeave } from "./handlers/race";

export async function handleMessage(conn: Connection, raw: unknown): Promise<void> {
  const parsed = ClientEvent.safeParse(raw);
  if (!parsed.success) {
    sendError(conn.ws, "INVALID_EVENT", "Unknown or malformed event", false);
    return;
  }

  const event = parsed.data;

  // session.auth와 ping은 인증 전에도 허용
  if (event.type === "session.auth") {
    return handleSessionAuth(conn, event);
  }
  if (event.type === "ping") {
    return handlePing(conn, event);
  }

  // 나머지 이벤트는 인증 필요
  if (!conn.authenticated) {
    sendError(conn.ws, "UNAUTHORIZED", "Send session.auth first", false);
    return;
  }

  switch (event.type) {
    case "queue.join":   return handleQueueJoin(conn, event);
    case "queue.leave":  return handleQueueLeave(conn, event);
    case "match.loaded": return handleMatchLoaded(conn, event);
    case "race.input":   return handleRaceInput(conn, event);
    case "race.leave":   return handleRaceLeave(conn, event);
  }
}
