// apps/ws-server/src/router.ts
import { ClientEvent } from "@type-arena/shared";
import { Connection } from "./types";
import { sendError } from "./utils";
import { handleSessionAuth, handlePing } from "./handlers/session";
import { handleQueueJoin, handleQueueLeave } from "./handlers/queue";
import { handleMatchLoaded, handleRaceInput, handleRaceLeave } from "./handlers/race";
import {
  handleRoomCreate,
  handleRoomJoin,
  handleRoomReady,
  handleRoomStart,
} from "./rooms/room-handler";
import { handleRoomInput } from "./rooms/room-race";

export async function handleMessage(conn: Connection, raw: unknown): Promise<void> {
  const parsed = ClientEvent.safeParse(raw);
  if (!parsed.success) {
    sendError(conn.ws, "INVALID_EVENT", "Unknown or malformed event", false);
    return;
  }

  const event = parsed.data;

  if (event.type === "session.auth") return handleSessionAuth(conn, event);
  if (event.type === "ping") return handlePing(conn, event);

  if (!conn.authenticated) {
    sendError(conn.ws, "UNAUTHORIZED", "Send session.auth first", false);
    return;
  }

  switch (event.type) {
    case "queue.join":   return handleQueueJoin(conn, event);
    case "queue.leave":  return handleQueueLeave(conn, event);
    case "match.loaded": return handleMatchLoaded(conn, event);
    case "race.input":
      if (event.roomId) return handleRoomInput(conn, event);
      return handleRaceInput(conn, event);
    case "race.leave":   return handleRaceLeave(conn, event);
    case "room.create":  return handleRoomCreate(conn, event);
    case "room.join":    return handleRoomJoin(conn, event);
    case "room.ready":   return handleRoomReady(conn, event);
    case "room.start":   return handleRoomStart(conn, event);
  }
}
