// apps/web/components/race/countdown.tsx
"use client";
import { useEffect, useState } from "react";
import { useRaceStore } from "@/lib/stores/race-store";
import { COUNTDOWN_MS } from "@type-arena/shared";

export function Countdown() {
  const { phase, startRacing } = useRaceStore();
  const [count, setCount] = useState(Math.ceil(COUNTDOWN_MS / 1000));

  useEffect(() => {
    if (phase !== "countdown") return;

    setCount(Math.ceil(COUNTDOWN_MS / 1000));
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startRacing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, startRacing]);

  if (phase !== "countdown") return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
      <span className="text-8xl font-bold text-indigo-400 animate-pulse">
        {count}
      </span>
    </div>
  );
}
