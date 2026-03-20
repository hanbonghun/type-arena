// apps/ws-server/src/handlers/session.ts
import jwt from "jsonwebtoken";
import { config } from "../config";
import { Connection } from "../types";
import { sendRaw, sendError } from "../utils";
import { z } from "zod";
import {
  SessionAuthEvent,
  PingEvent,
  SessionOkEvent,
} from "@type-arena/shared";

interface WsTokenPayload {
  sub: string;
  type: "user" | "guest";
  nickname: string;
  iat: number;
  exp: number;
}

export function handleSessionAuth(
  conn: Connection,
  event: z.infer<typeof SessionAuthEvent>
): void {
  let payload: WsTokenPayload;

  try {
    payload = jwt.verify(event.token, config.WS_JWT_SECRET) as WsTokenPayload;
  } catch {
    sendError(conn.ws, "AUTH_FAILED", "Invalid or expired token", false);
    return;
  }

  conn.participantId = payload.sub;
  conn.participantType = payload.type;
  conn.nickname = payload.nickname;
  conn.authenticated = true;

  const response: SessionOkEvent = {
    type: "session.ok",
    participantId: payload.sub,
    participantType: payload.type,
    nickname: payload.nickname,
  };
  sendRaw(conn.ws, response);
}

export function handlePing(
  conn: Connection,
  event: z.infer<typeof PingEvent>
): void {
  void event;
  sendRaw(conn.ws, { type: "pong", serverTs: Date.now() });
}
