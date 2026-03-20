// apps/web/components/race/typing-input.tsx
"use client";
import { useEffect } from "react";
import { useRaceStore } from "@/lib/stores/race-store";

export function TypingInput() {
  const { phase, handleKeyPress, startRacing } = useRaceStore();

  useEffect(() => {
    if (phase !== "racing" && phase !== "idle") return;

    function onKeyDown(e: KeyboardEvent) {
      // 붙여넣기 차단 (기능정의서 5.2절)
      if (e.ctrlKey || e.metaKey) return;
      // IME 조합 중 개별 키 이벤트 무시 (compositionend에서 처리)
      if (e.isComposing) return;

      const kind = e.key === "Backspace" ? "backspace" : "type";
      const value = kind === "type" ? e.key : undefined;
      if (kind === "type" && value?.length !== 1) return;
      e.preventDefault();

      // idle 상태에서 첫 키 입력 시 레이스 시작
      if (phase === "idle") {
        startRacing();
      }
      handleKeyPress(e.key);
    }

    // IME 조합 완료 시 (한글 등) — 오타 피드백을 위해 처리
    function onCompositionEnd(e: CompositionEvent) {
      if (phase === "idle") startRacing();
      for (const char of e.data) {
        handleKeyPress(char);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("compositionend", onCompositionEnd);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [phase, handleKeyPress]);

  return null; // 비시각 컴포넌트, 키보드 이벤트만 처리
}
