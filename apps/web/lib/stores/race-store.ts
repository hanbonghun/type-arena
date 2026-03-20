// apps/web/lib/stores/race-store.ts
"use client";
import { create } from "zustand";
import { calcWpm, calcAccuracy, calcProgress, MATCH_TIMEOUT_MS } from "@type-arena/shared";

export type RacePhase = "idle" | "countdown" | "racing" | "finished";

interface RaceState {
  phase: RacePhase;
  promptText: string;
  promptId: string;

  // 입력 상태
  cursorPos: number;       // 현재 확정된 정확 위치
  hasMistake: boolean;     // 현재 위치가 mistake인지
  mistakeChar: string;     // 잘못 입력한 문자

  // 통계
  correctChars: number;
  incorrectKeystrokes: number;
  totalKeystrokes: number;
  startedAt: number | null;
  finishedAt: number | null;

  // 계산된 값
  wpm: number;
  accuracy: number;
  progress: number;
  elapsedMs: number;

  // Actions
  init: (promptId: string, promptText: string) => void;
  startCountdown: () => void;
  startRacing: () => void;
  handleKeyPress: (key: string) => void;
  tick: () => void;
  reset: () => void;
}

export const useRaceStore = create<RaceState>((set, get) => ({
  phase: "idle",
  promptText: "",
  promptId: "",
  cursorPos: 0,
  hasMistake: false,
  mistakeChar: "",
  correctChars: 0,
  incorrectKeystrokes: 0,
  totalKeystrokes: 0,
  startedAt: null,
  finishedAt: null,
  wpm: 0,
  accuracy: 0,
  progress: 0,
  elapsedMs: 0,

  init: (promptId, promptText) =>
    set({
      phase: "idle",
      promptId,
      promptText,
      cursorPos: 0,
      hasMistake: false,
      mistakeChar: "",
      correctChars: 0,
      incorrectKeystrokes: 0,
      totalKeystrokes: 0,
      startedAt: null,
      finishedAt: null,
      wpm: 0,
      accuracy: 0,
      progress: 0,
      elapsedMs: 0,
    }),

  startCountdown: () => set({ phase: "countdown" }),

  startRacing: () => set({ phase: "racing", startedAt: Date.now() }),

  handleKeyPress: (key: string) => {
    const state = get();
    if (state.phase !== "racing") return;

    // Backspace 처리
    if (key === "Backspace") {
      if (state.hasMistake) {
        set({ hasMistake: false, mistakeChar: "" });
      }
      return;
    }

    // 단일 문자만 허용
    if (key.length !== 1) return;

    const newTotal = state.totalKeystrokes + 1;

    // mistake 상태에서 추가 입력은 무시 (Backspace로 먼저 해제해야 함)
    if (state.hasMistake) {
      set({ totalKeystrokes: newTotal, incorrectKeystrokes: state.incorrectKeystrokes + 1 });
      return;
    }

    const expected = state.promptText[state.cursorPos];

    if (key === expected) {
      const newCorrect = state.correctChars + 1;
      const newPos = state.cursorPos + 1;
      const finished = newPos >= state.promptText.length;

      set({
        cursorPos: newPos,
        correctChars: newCorrect,
        totalKeystrokes: newTotal,
        progress: calcProgress(newCorrect, state.promptText.length),
        ...(finished
          ? { phase: "finished" as const, finishedAt: Date.now() }
          : {}),
      });
    } else {
      // mistake 발생
      set({
        hasMistake: true,
        mistakeChar: key,
        totalKeystrokes: newTotal,
        incorrectKeystrokes: state.incorrectKeystrokes + 1,
      });
    }
  },

  tick: () => {
    const state = get();
    if (state.phase !== "racing" || !state.startedAt) return;

    const elapsed = Date.now() - state.startedAt;

    // 120초 타임아웃 (기능정의서 5.3절)
    if (elapsed >= MATCH_TIMEOUT_MS) {
      set({ phase: "finished", finishedAt: Date.now(), elapsedMs: MATCH_TIMEOUT_MS });
      return;
    }

    set({
      elapsedMs: elapsed,
      wpm: calcWpm(state.correctChars, elapsed),
      accuracy: calcAccuracy(
        state.correctChars,
        state.incorrectKeystrokes
      ),
      progress: calcProgress(state.correctChars, state.promptText.length),
    });
  },

  reset: () =>
    set({
      phase: "idle",
      promptText: "",
      promptId: "",
      cursorPos: 0,
      hasMistake: false,
      mistakeChar: "",
      correctChars: 0,
      incorrectKeystrokes: 0,
      totalKeystrokes: 0,
      startedAt: null,
      finishedAt: null,
      wpm: 0,
      accuracy: 0,
      progress: 0,
      elapsedMs: 0,
    }),
}));
