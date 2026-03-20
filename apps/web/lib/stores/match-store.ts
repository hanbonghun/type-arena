// apps/web/lib/stores/match-store.ts
"use client";
import { create } from "zustand";
import { ServerEvent, RaceResultEvent, MatchAssignedEvent, RaceProgressEvent } from "@type-arena/shared";
import { wsClient } from "@/lib/ws-client";

export type MatchPhase =
  | "idle"           // WS 연결 전
  | "connecting"     // WS 연결 중
  | "authenticated"  // session.ok 받음
  | "queuing"        // queue.join 전송 후
  | "loading"        // match.assigned 받음, match.loaded 전송 후
  | "countdown"      // countdown.start 받음
  | "racing"         // 레이스 진행 중
  | "finished";      // race.result 받음

interface MatchState {
  phase: MatchPhase;
  matchId: string | null;
  promptText: string;
  promptId: string;
  slot: 0 | 1 | null;
  opponentNickname: string;

  // 실시간 통계 (서버 확정값)
  selfProgress: number;
  selfWpm: number;
  selfAccuracy: number;
  opponentProgress: number;
  opponentWpm: number;

  // 서버 시작 시각 (카운트다운)
  serverStartAt: number | null;

  // 결과
  result: RaceResultEvent | null;

  // Actions
  connectAndAuth: (token: string) => void;
  joinQueue: () => void;
  sendLoaded: (matchId: string) => void;
  sendInput: (matchId: string, seq: number, kind: "type" | "backspace", value?: string) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  phase: "idle",
  matchId: null,
  promptText: "",
  promptId: "",
  slot: null,
  opponentNickname: "",
  selfProgress: 0,
  selfWpm: 0,
  selfAccuracy: 0,
  opponentProgress: 0,
  opponentWpm: 0,
  serverStartAt: null,
  result: null,

  connectAndAuth: (token) => {
    set({ phase: "connecting" });

    wsClient.connect(token);

    // WS 이벤트 → store 상태 매핑
    wsClient.on((event: ServerEvent) => {
      switch (event.type) {
        case "session.ok":
          set({ phase: "authenticated" });
          break;

        case "queue.status":
          if (event.state === "queuing") set({ phase: "queuing" });
          break;

        case "match.assigned": {
          const e = event as MatchAssignedEvent;
          set({
            phase: "loading",
            matchId: e.matchId,
            promptText: e.promptText,
            promptId: e.promptId,
            slot: e.slot,
            opponentNickname: e.opponentNickname,
          });
          // match.loaded 즉시 전송
          get().sendLoaded(e.matchId);
          break;
        }

        case "countdown.start":
          set({ phase: "countdown", serverStartAt: event.serverStartAt });
          break;

        case "race.progress": {
          const e = event as RaceProgressEvent;
          set({
            phase: "racing",
            selfProgress: e.selfProgress,
            selfWpm: e.selfWpm,
            selfAccuracy: e.selfAccuracy,
            opponentProgress: e.opponentProgress,
            opponentWpm: e.opponentWpm,
          });
          break;
        }

        case "race.result":
          set({ phase: "finished", result: event as RaceResultEvent });
          break;

        case "error":
          console.error("WS error:", event.code, event.message);
          break;
      }
    });
  },

  joinQueue: () => {
    wsClient.send({ type: "queue.join", mode: "ranked" });
    set({ phase: "queuing" });
  },

  sendLoaded: (matchId) => {
    wsClient.send({ type: "match.loaded", matchId });
  },

  sendInput: (matchId, seq, kind, value) => {
    wsClient.send({ type: "race.input", matchId, seq, kind, value });
  },

  reset: () => {
    wsClient.disconnect();
    set({
      phase: "idle",
      matchId: null,
      promptText: "",
      promptId: "",
      slot: null,
      opponentNickname: "",
      selfProgress: 0,
      selfWpm: 0,
      selfAccuracy: 0,
      opponentProgress: 0,
      opponentWpm: 0,
      serverStartAt: null,
      result: null,
    });
  },
}));
