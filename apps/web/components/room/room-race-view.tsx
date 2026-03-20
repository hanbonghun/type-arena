// apps/web/components/room/room-race-view.tsx
"use client";
import { PromptDisplay } from "@/components/race/prompt-display";
import { ProgressBar } from "@/components/race/progress-bar";

interface PlayerProgress {
  participantId: string;
  progress: number;
  wpm: number;
  accuracy: number;
}

interface RoomRaceViewProps {
  myId: string;
  promptText: string;
  raceProgress: PlayerProgress[];
  players: Array<{ participantId: string; nickname: string }>;
  selfWpm: number;
  selfAccuracy: number;
}

export function RoomRaceView({
  myId,
  promptText,
  raceProgress,
  players,
  selfWpm,
  selfAccuracy,
}: RoomRaceViewProps) {
  const opponents = players.filter((p) => p.participantId !== myId);

  return (
    <main className="flex items-start justify-center min-h-screen px-4 py-8 gap-4">
      {/* 내 화면 (좌측, 크게) */}
      <div className="flex-1 flex flex-col gap-3 max-w-2xl">
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span className="font-semibold text-indigo-400">You</span>
          <span>{Math.round(selfWpm)} WPM · {selfAccuracy.toFixed(1)}%</span>
        </div>
        <ProgressBar />
        <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
          <PromptDisplay />
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-px bg-gray-800 self-stretch mt-8" />

      {/* 상대방 패널 (우측, 세로 나열) */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        {opponents.map((opp) => {
          const prog = raceProgress.find((p) => p.participantId === opp.participantId);
          const progress = prog?.progress ?? 0;
          const wpm = prog?.wpm ?? 0;
          const cursorPos = Math.round(progress * promptText.length);

          return (
            <div key={opp.participantId} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span className="font-medium text-rose-400">{opp.nickname}</span>
                <span>{Math.round(wpm)} WPM</span>
              </div>
              <div className="text-xs leading-relaxed font-mono select-none bg-gray-900/60 rounded-lg p-2 border border-gray-800 max-h-20 overflow-hidden">
                {promptText.split("").map((char, i) => {
                  let className = "text-gray-600";
                  if (i < cursorPos) className = "text-rose-400/80";
                  else if (i === cursorPos) className = "bg-rose-900/50 text-rose-200";
                  return (
                    <span key={i} className={className}>
                      {char === " " && i === cursorPos ? "\u00B7" : char}
                    </span>
                  );
                })}
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1">
                <div
                  className="bg-rose-500 h-1 rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
