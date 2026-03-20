// apps/web/components/room/room-result-view.tsx
"use client";
import { RoomRanking } from "@type-arena/shared";
import { Button } from "@/components/ui/button";

const RANK_COLORS = ["text-yellow-400", "text-gray-300", "text-amber-600", "text-gray-500"];
const RANK_LABELS = ["1st", "2nd", "3rd", "4th"];

interface RoomResultViewProps {
  rankings: RoomRanking[];
  myId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function RoomResultView({ rankings, myId, onPlayAgain, onLeave }: RoomResultViewProps) {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <h1 className="text-4xl font-bold">Results</h1>

      <div className="w-full max-w-md space-y-2">
        {rankings.map((r) => (
          <div
            key={r.participantId}
            className={`flex items-center gap-4 bg-gray-900 border rounded-xl px-4 py-3 ${
              r.participantId === myId ? "border-indigo-500/50" : "border-gray-800"
            }`}
          >
            <span className={`text-lg font-bold w-10 ${RANK_COLORS[r.rank - 1] ?? "text-gray-500"}`}>
              {RANK_LABELS[r.rank - 1] ?? `${r.rank}th`}
            </span>
            <span className="flex-1 font-medium">
              {r.nickname}
              {r.participantId === myId && (
                <span className="text-indigo-400 text-sm ml-1">(You)</span>
              )}
            </span>
            <div className="text-right text-sm text-gray-400 space-y-0.5">
              <div className="font-semibold text-white">{Math.round(r.wpm)} WPM</div>
              <div>{r.accuracy.toFixed(1)}%</div>
              {r.finishMs && (
                <div className="text-xs">{(r.finishMs / 1000).toFixed(1)}s</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Button onClick={onPlayAgain}>Play Again</Button>
        <Button variant="secondary" onClick={onLeave}>Leave</Button>
      </div>
    </main>
  );
}
