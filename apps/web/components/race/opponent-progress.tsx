// apps/web/components/race/opponent-progress.tsx
"use client";

interface OpponentProgressProps {
  progress: number; // 0~1
  wpm: number;
  nickname: string;
}

export function OpponentProgress({ progress, wpm, nickname }: OpponentProgressProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{nickname}</span>
        <span>{Math.round(wpm)} WPM</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div
          className="bg-rose-500 h-2 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
