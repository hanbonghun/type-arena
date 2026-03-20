// apps/web/app/practice/result/page.tsx
"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function ResultContent() {
  const params = useSearchParams();

  const wpm = params.get("wpm") ?? "0";
  const accuracy = params.get("accuracy") ?? "0";
  const elapsed = Number(params.get("elapsed") ?? 0);
  const chars = params.get("chars") ?? "0";
  const keystrokes = params.get("keystrokes") ?? "0";

  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-8">
      <h1 className="text-4xl font-bold text-indigo-400">Practice Complete</h1>

      <div className="grid grid-cols-2 gap-6 w-full max-w-md">
        <StatCard label="WPM" value={wpm} />
        <StatCard label="Accuracy" value={`${accuracy}%`} />
        <StatCard label="Time" value={`${seconds}s`} />
        <StatCard label="Characters" value={`${chars}/${keystrokes}`} />
      </div>

      <div className="flex gap-4 mt-4">
        <Link href="/practice">
          <Button>Try Again</Button>
        </Link>
        <Link href="/">
          <Button variant="secondary">Home</Button>
        </Link>
      </div>

      <p className="text-gray-600 text-sm">
        Sign up for Ranked to compete against others!
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-gray-400">Loading...</p>}>
      <ResultContent />
    </Suspense>
  );
}
