// apps/web/components/race/opponent-typing-view.tsx
"use client";

interface OpponentTypingViewProps {
  promptText: string;
  progress: number; // 0~1, 서버에서 오는 correctChars / promptLength
  wpm: number;
  nickname: string;
}

export function OpponentTypingView({
  promptText,
  progress,
  wpm,
  nickname,
}: OpponentTypingViewProps) {
  // progress(0~1) → 상대방이 맞게 입력한 문자 수
  const cursorPos = Math.round(progress * promptText.length);

  return (
    <div className="flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span className="font-medium text-rose-400">{nickname}</span>
        <span>{Math.round(wpm)} WPM</span>
      </div>

      {/* 상대방 타이핑 텍스트 (읽기 전용, 작게) */}
      <div
        className="text-sm leading-relaxed font-mono select-none bg-gray-900/60 rounded-lg p-3 border border-gray-800"
        aria-label="Opponent typing state"
      >
        {promptText.split("").map((char, i) => {
          let className = "text-gray-600"; // 미입력

          if (i < cursorPos) {
            className = "text-rose-400/80"; // 상대가 입력 완료한 부분
          } else if (i === cursorPos) {
            className = "bg-rose-900/50 text-rose-200"; // 상대 커서 위치
          }

          return (
            <span key={i} className={className}>
              {char === " " && i === cursorPos ? "\u00B7" : char}
            </span>
          );
        })}
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-800 rounded-full h-1">
        <div
          className="bg-rose-500 h-1 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
