// apps/ws-server/src/utils.ts
import { WebSocket } from "ws";
import { ServerEvent } from "@type-arena/shared";

export function sendRaw(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function broadcastToMatch(
  connections: [import("./types").Connection | null, import("./types").Connection | null],
  event: ServerEvent
): void {
  for (const conn of connections) {
    if (conn?.ws) sendRaw(conn.ws, event);
  }
}

export function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  retryable: boolean
): void {
  sendRaw(ws, { type: "error", code, message, retryable });
}
