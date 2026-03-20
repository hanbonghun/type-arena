// apps/web/components/race/prompt-display.tsx
"use client";
import { useRaceStore } from "@/lib/stores/race-store";

export function PromptDisplay() {
  const { promptText, cursorPos, hasMistake } = useRaceStore();

  return (
    <div className="text-2xl leading-relaxed font-mono select-none" aria-label="Typing prompt">
      {promptText.split("").map((char, i) => {
        let className = "text-gray-600"; // 미입력

        if (i < cursorPos) {
          className = "text-green-400"; // 정확히 입력 완료
        } else if (i === cursorPos) {
          if (hasMistake) {
            className = "bg-red-900/60 text-red-300"; // 오류
          } else {
            className = "bg-gray-700 text-white"; // 현재 커서
          }
        }

        return (
          <span key={i} className={className}>
            {char === " " && i === cursorPos ? "\u00B7" : char}
          </span>
        );
      })}
    </div>
  );
}
