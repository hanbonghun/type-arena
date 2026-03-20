// apps/web/app/match/[id]/result/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMatchStore } from "@/lib/stores/match-store";
import { Button } from "@/components/ui/button";

const outcomeLabel: Record<string, { text: string; color: string }> = {
  win:      { text: "Victory!",    color: "text-green-400" },
  loss:     { text: "Defeat",      color: "text-red-400" },
  draw:     { text: "Draw",        color: "text-yellow-400" },
  forfeit:  { text: "Opponent Forfeited", color: "text-indigo-400" },
  no_result:{ text: "No Result",   color: "text-gray-400" },
};

export default function MatchResultPage() {
  const { result, reset } = useMatchStore();
  const router = useRouter();

  // result가 없으면 (직접 URL 접근 등) 홈으로
  useEffect(() => {
    if (!result) {
      router.replace("/");
    }
  }, [result, router]);

  if (!result) return null;

  const label = outcomeLabel[result.outcome] ?? { text: result.outcome, color: "text-white" };
  const { myStats, opponentStats } = result;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-8">
      <h1 className={`text-5xl font-bold ${label.color}`}>{label.text}</h1>

      <div className="grid grid-cols-2 gap-8 w-full max-w-lg">
        <div className="space-y-3">
          <p className="text-gray-400 text-sm text-center">You</p>
          <StatCard label="WPM" value={Math.round(myStats.wpm).toString()} />
          <StatCard label="Accuracy" value={`${myStats.accuracy.toFixed(1)}%`} />
          <StatCard
            label="Time"
            value={myStats.finishMs ? `${(myStats.finishMs / 1000).toFixed(1)}s` : "—"}
          />
        </div>
        <div className="space-y-3">
          <p className="text-gray-400 text-sm text-center">Opponent</p>
          <StatCard label="WPM" value={Math.round(opponentStats.wpm).toString()} />
          <StatCard label="Accuracy" value={`${opponentStats.accuracy.toFixed(1)}%`} />
          <StatCard
            label="Time"
            value={opponentStats.finishMs ? `${(opponentStats.finishMs / 1000).toFixed(1)}s` : "—"}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Link href="/ranked" onClick={reset}>
          <Button>Play Again</Button>
        </Link>
        <Link href="/" onClick={reset}>
          <Button variant="secondary">Home</Button>
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
