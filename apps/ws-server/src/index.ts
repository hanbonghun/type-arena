// apps/ws-server/src/index.ts
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "../../../.env") });
import Fastify from "fastify";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config";
import { createConnection, removeConnection } from "./connection-store";
import { handleMessage } from "./router";
import { handleDisconnect } from "./handlers/race";
import { sendError } from "./utils";

async function main() {
  const fastify = Fastify({ logger: true });

  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  const server = createServer(fastify.server);
  const wss = new WebSocketServer({
    server,
    verifyClient: ({ origin }: { origin: string }, cb: (result: boolean, code?: number, message?: string) => void) => {
      const allowed = config.CORS_ORIGIN.split(",").map((s) => s.trim());
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        cb(true);
      } else {
        cb(false, 403, "Forbidden");
      }
    },
  });

  wss.on("connection", (ws: WebSocket) => {
    const conn = createConnection(ws);
    fastify.log.info(`WS connected: ${conn.connId}`);

    ws.on("message", async (data: Buffer) => {
      try {
        const raw = JSON.parse(data.toString()) as unknown;
        await handleMessage(conn, raw);
      } catch (err) {
        fastify.log.error(err, "Message handling error");
        sendError(ws, "INTERNAL_ERROR", "Internal server error", true);
      }
    });

    ws.on("close", () => {
      fastify.log.info(`WS disconnected: ${conn.connId}`);
      handleDisconnect(conn);
      removeConnection(conn.connId);
    });

    ws.on("error", (err: Error) => {
      fastify.log.error(err, `WS error: ${conn.connId}`);
    });
  });

  await fastify.ready();
  server.listen(config.WS_PORT, "0.0.0.0", () => {
    fastify.log.info(`WS server listening on port ${config.WS_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
