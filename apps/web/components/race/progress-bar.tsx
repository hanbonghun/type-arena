// apps/web/components/race/progress-bar.tsx
"use client";
import { useRaceStore } from "@/lib/stores/race-store";

export function ProgressBar() {
  const progress = useRaceStore((s) => s.progress);

  return (
    <div className="w-full bg-gray-800 rounded-full h-2">
      <div
        className="bg-indigo-500 h-2 rounded-full transition-all duration-100"
        style={{ width: `${Math.min(progress * 100, 100)}%` }}
      />
    </div>
  );
}
