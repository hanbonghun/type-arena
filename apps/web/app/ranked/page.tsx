// apps/web/app/ranked/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMatchStore } from "@/lib/stores/match-store";
import { Button } from "@/components/ui/button";

export default function RankedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { phase, matchId, connectAndAuth, joinQueue, reset } = useMatchStore();

  // 로그인 확인
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  // WS 연결 및 큐 진입
  useEffect(() => {
    if (status !== "authenticated" || phase !== "idle") return;

    async function initWs() {
      try {
        const res = await fetch("/api/v1/auth/ws-token");
        if (!res.ok) throw new Error("Token fetch failed");
        const { token } = await res.json() as { token: string };
        connectAndAuth(token);
      } catch (err) {
        console.error("WS init failed:", err);
      }
    }

    initWs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // authenticated 상태가 되면 자동으로 큐 진입
  useEffect(() => {
    if (phase === "authenticated") {
      joinQueue();
    }
  }, [phase, joinQueue]);

  // 매치 배정 시 race 화면으로 이동 (loading or countdown — countdown.start가 먼저 올 수 있음)
  useEffect(() => {
    if (matchId && (phase === "loading" || phase === "countdown" || phase === "racing")) {
      router.push(`/match/${matchId}/race`);
    }
  }, [phase, matchId, router]);

  const handleCancel = () => {
    reset();
    router.push("/");
  };

  if (status === "loading" || phase === "idle" || phase === "connecting") {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-xl">Connecting...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Finding Opponent</h1>
        <p className="text-gray-400">Looking for a ranked match...</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
        </div>
      </div>

      <Button variant="secondary" onClick={handleCancel}>
        Cancel
      </Button>

      <p className="text-gray-600 text-sm">
        Phase 2: Simple FIFO matching — first two players get matched instantly
      </p>
    </main>
  );
}
