// apps/web/components/race/typing-input.tsx
"use client";
import { useEffect } from "react";
import { useRaceStore } from "@/lib/stores/race-store";

export function TypingInput() {
  const { phase, handleKeyPress } = useRaceStore();

  useEffect(() => {
    if (phase !== "racing") return;

    function onKeyDown(e: KeyboardEvent) {
      // 붙여넣기 차단 (기능정의서 5.2절)
      if (e.ctrlKey || e.metaKey) return;
      // IME 차단
      if (e.isComposing) return;

      e.preventDefault();
      handleKeyPress(e.key);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, handleKeyPress]);

  return null; // 비시각 컴포넌트, 키보드 이벤트만 처리
}
