// apps/web/app/ranked/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMatchStore } from "@/lib/stores/match-store";
import { Button } from "@/components/ui/button";

const GUEST_SESSION_KEY = "type_arena_guest";

interface GuestSession {
  id: string;
  nickname: string;
  token: string;
  expiresAt: string;
}

function getStoredGuest(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GuestSession;
    if (new Date(g.expiresAt) < new Date()) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

export default function RankedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { phase, matchId, connectAndAuth, joinQueue, reset } = useMatchStore();

  // WS 연결: 로그인 유저는 ws-token API, 게스트는 localStorage 토큰
  useEffect(() => {
    if (status === "loading") return;
    if (phase !== "idle") return;

    async function initWs() {
      let token: string | null = null;

      if (session?.user) {
        // 로그인 유저
        const res = await fetch("/api/v1/auth/ws-token");
        if (!res.ok) { router.replace("/"); return; }
        const data = await res.json() as { token: string };
        token = data.token;
      } else {
        // 게스트
        const guest = getStoredGuest();
        if (!guest) { router.replace("/"); return; }
        token = guest.token;
      }

      connectAndAuth(token);
    }

    initWs().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // authenticated 상태가 되면 자동으로 큐 진입
  useEffect(() => {
    if (phase === "authenticated") {
      joinQueue();
    }
  }, [phase, joinQueue]);

  // 매치 배정 시 race 화면으로 이동
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
        <p className="text-gray-400">Looking for a match...</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
        </div>
      </div>

      <Button variant="secondary" onClick={handleCancel}>
        Cancel
      </Button>
    </main>
  );
}
