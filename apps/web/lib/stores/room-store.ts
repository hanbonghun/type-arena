// apps/web/lib/stores/room-store.ts
"use client";
import { create } from "zustand";
import {
  ServerEvent,
  RoomPlayerPublic,
  RoomRanking,
} from "@type-arena/shared";
import { wsClient } from "@/lib/ws-client";

export type RoomPhase = "idle" | "lobby" | "countdown" | "racing" | "finished";

interface RoomProgressEntry {
  participantId: string;
  progress: number;
  wpm: number;
  accuracy: number;
}

interface RoomState {
  phase: RoomPhase;
  roomId: string | null;
  roomCode: string | null;
  promptText: string;
  hostId: string | null;
  myId: string | null;
  players: RoomPlayerPublic[];
  raceProgress: RoomProgressEntry[];
  rankings: RoomRanking[];
  serverStartAt: number | null;
  retireAt: number | null;

  connectAndAuth: (token: string) => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  toggleReady: () => void;
  startRoom: () => void;
  sendInput: (seq: number, kind: "type" | "backspace", value?: string) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  phase: "idle",
  roomId: null,
  roomCode: null,
  promptText: "",
  hostId: null,
  myId: null,
  players: [],
  raceProgress: [],
  rankings: [],
  serverStartAt: null,
  retireAt: null,

  connectAndAuth: (token) => {
    wsClient.connect(token);

    wsClient.on((event: ServerEvent) => {
      switch (event.type) {
        case "session.ok":
          set({ myId: event.participantId });
          break;

        case "room.created":
          set({
            phase: "lobby",
            roomId: event.roomId,
            roomCode: event.roomCode,
            promptText: event.promptText,
          });
          break;

        case "room.joined":
          set({
            phase: "lobby",
            roomId: event.roomId,
            roomCode: event.roomCode,
            promptText: event.promptText,
            hostId: event.hostId,
            players: event.players,
          });
          break;

        case "room.state":
          set({
            phase: event.phase === "lobby" ? "lobby" : get().phase,
            hostId: event.hostId,
            players: event.players,
          });
          break;

        case "room.countdown":
          set({ phase: "countdown", serverStartAt: event.serverStartAt });
          break;

        case "room.progress":
          set({ raceProgress: event.players });
          break;

        case "room.retiring":
          set({ retireAt: event.retireAt });
          break;

        case "room.finished":
          set({ phase: "finished", rankings: event.rankings, retireAt: null });
          break;
      }
    });
  },

  createRoom: () => {
    wsClient.send({ type: "room.create" });
  },

  joinRoom: (roomCode) => {
    wsClient.send({ type: "room.join", roomCode });
  },

  toggleReady: () => {
    const { roomId } = get();
    if (roomId) wsClient.send({ type: "room.ready", roomId });
  },

  startRoom: () => {
    const { roomId } = get();
    if (roomId) wsClient.send({ type: "room.start", roomId });
  },

  sendInput: (seq, kind, value) => {
    const { roomId } = get();
    if (roomId) wsClient.send({ type: "race.input", roomId, seq, kind, value });
  },

  reset: () => {
    wsClient.disconnect();
    set({
      phase: "idle",
      roomId: null,
      roomCode: null,
      promptText: "",
      hostId: null,
      myId: null,
      players: [],
      raceProgress: [],
      rankings: [],
      serverStartAt: null,
      retireAt: null,
    });
  },
}));
