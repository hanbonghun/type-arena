// apps/web/lib/ws-client.ts
"use client";
import { ServerEvent } from "@type-arena/shared";

type EventHandler = (event: ServerEvent) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private handlers = new Set<EventHandler>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(token: string): void {
    this.token = token;
    this.shouldConnect = true;
    this.reconnectDelay = 1000;
    this.open();
  }

  disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.ws?.close();
    this.ws = null;
  }

  send(event: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  on(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private open(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      // 연결 즉시 session.auth 전송
      if (this.token) {
        this.send({ type: "session.auth", token: this.token });
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as ServerEvent;
        this.handlers.forEach((h) => h(event));
      } catch {
        console.error("WS parse error", e.data);
      }
    };

    this.ws.onclose = () => {
      if (!this.shouldConnect) return;
      // 지수 백오프 재연결 (최대 10초)
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
        this.open();
      }, this.reconnectDelay);
    };

    this.ws.onerror = (err) => {
      console.error("WS error", err);
    };
  }
}

// 싱글턴 — 탭당 하나의 WS 연결
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8081";
export const wsClient = new WsClient(WS_URL);
