// apps/web/app/practice/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRaceStore } from "@/lib/stores/race-store";
import { PromptDisplay } from "@/components/race/prompt-display";
import { TypingInput } from "@/components/race/typing-input";
import { ProgressBar } from "@/components/race/progress-bar";
import { Countdown } from "@/components/race/countdown";
import { LiveStats } from "@/components/race/live-stats";

export default function PracticePage() {
  const router = useRouter();
  const { phase, init, startCountdown } = useRaceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrompt() {
      try {
        const res = await fetch("/api/v1/practice-matches", { method: "POST" });
        if (!res.ok) throw new Error("프롬프트 로드 실패");
        const data = await res.json() as { promptId: string; text: string; checksum: string };
        init(data.promptId, data.text);
        setLoading(false);
        // 자동으로 카운트다운 시작
        startCountdown();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      }
    }
    loadPrompt();
  }, [init, startCountdown]);

  // 경기 완료 시 결과 페이지로 이동
  useEffect(() => {
    if (phase === "finished") {
      const state = useRaceStore.getState();
      const params = new URLSearchParams({
        wpm: Math.round(state.wpm).toString(),
        accuracy: state.accuracy.toFixed(1),
        elapsed: state.elapsedMs.toString(),
        chars: state.correctChars.toString(),
        keystrokes: state.totalKeystrokes.toString(),
        promptId: state.promptId,
      });
      router.push(`/practice/result?${params}`);
    }
  }, [phase, router]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-xl">Loading prompt...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
      <Countdown />
      <TypingInput />

      <div className="w-full max-w-3xl space-y-6">
        <ProgressBar />
        <PromptDisplay />
        <LiveStats />
      </div>

      <p className="text-gray-600 text-sm mt-4">
        {phase === "racing" ? "Start typing..." : "Get ready..."}
      </p>
    </main>
  );
}
