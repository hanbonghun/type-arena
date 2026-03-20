// apps/web/components/race/prompt-display.tsx
"use client";
import { useRaceStore } from "@/lib/stores/race-store";

export function PromptDisplay() {
  const { promptText, cursorPos, hasMistake, mistakeChar } = useRaceStore();

  return (
    <div className="text-2xl leading-relaxed font-mono select-none" aria-label="Typing prompt">
      {promptText.split("").map((char, i) => {
        let className = "text-gray-600"; // 미입력
        let displayChar: string = char === " " && i === cursorPos ? "\u00B7" : char;

        if (i < cursorPos) {
          className = "text-green-400"; // 정확히 입력 완료
        } else if (i === cursorPos) {
          if (hasMistake) {
            // 실제 잘못 입력한 문자를 빨갛게 표시
            className = "bg-red-900/60 text-red-400 animate-pulse";
            displayChar = mistakeChar === " " ? "\u00B7" : (mistakeChar || "\u00B7");
          } else {
            className = "bg-gray-700 text-white"; // 현재 커서
          }
        }

        return (
          <span key={i} className={className}>
            {displayChar}
          </span>
        );
      })}
    </div>
  );
}
