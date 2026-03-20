// apps/ws-server/src/connection-store.ts
import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { Connection, LiveMatch } from "./types";

// 연결 관리
const connections = new Map<string, Connection>();
// 매치 관리 (matchId → LiveMatch)
const liveMatches = new Map<string, LiveMatch>();
// 간이 대기열: 큐에서 대기 중인 Connection
let waitingConnection: Connection | null = null;

export function createConnection(ws: WebSocket): Connection {
  const conn: Connection = {
    connId: randomUUID(),
    ws,
    participantId: null,
    participantType: null,
    nickname: null,
    matchId: null,
    matchSlot: null,
    authenticated: false,
  };
  connections.set(conn.connId, conn);
  return conn;
}

export function removeConnection(connId: string): void {
  connections.delete(connId);
}

export function getWaiting(): Connection | null {
  return waitingConnection;
}

export function setWaiting(conn: Connection | null): void {
  waitingConnection = conn;
}

export function getMatch(matchId: string): LiveMatch | undefined {
  return liveMatches.get(matchId);
}

export function setMatch(matchId: string, match: LiveMatch): void {
  liveMatches.set(matchId, match);
}

export function deleteMatch(matchId: string): void {
  liveMatches.delete(matchId);
}
