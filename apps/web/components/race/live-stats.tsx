// apps/web/components/race/live-stats.tsx
"use client";
import { useEffect } from "react";
import { useRaceStore } from "@/lib/stores/race-store";

export function LiveStats() {
  const { phase, wpm, accuracy, elapsedMs, tick } = useRaceStore();

  useEffect(() => {
    if (phase !== "racing") return;
    const interval = setInterval(tick, 100); // 100ms마다 갱신
    return () => clearInterval(interval);
  }, [phase, tick]);

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="flex gap-8 text-sm text-gray-400">
      <div>
        <span className="text-2xl font-bold text-white">{Math.round(wpm)}</span>
        <span className="ml-1">WPM</span>
      </div>
      <div>
        <span className="text-2xl font-bold text-white">
          {accuracy > 0 ? `${accuracy.toFixed(1)}` : "---"}
        </span>
        <span className="ml-1">%</span>
      </div>
      <div>
        <span className="text-2xl font-bold text-white">{seconds}</span>
        <span className="ml-1">s</span>
      </div>
    </div>
  );
}
