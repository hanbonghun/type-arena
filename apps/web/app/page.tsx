// apps/web/app/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePlayNow() {
    setLoading(true);
    try {
      // 로그인된 유저는 바로 ranked로
      if (session?.user) {
        router.push("/ranked");
        return;
      }

      // 기존 유효한 게스트 세션 재사용
      const existing = getStoredGuest();
      if (existing) {
        router.push("/ranked");
        return;
      }

      // 새 게스트 세션 생성
      const res = await fetch("/api/v1/guest-sessions", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create guest session");
      const guest = await res.json() as GuestSession;
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guest));
      router.push("/ranked");
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  const isLoading = status === "loading" || loading;
  const user = session?.user;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">Type Arena</h1>
        <p className="text-gray-400 text-lg">Competitive typing. Pure speed.</p>
        <span className="inline-block mt-2 px-3 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded-full">
          Beta
        </span>
        {user && (
          <p className="mt-3 text-gray-400 text-sm flex items-center gap-2 justify-center">
            Welcome back, <span className="text-white font-semibold">{user.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-xs text-gray-600 hover:text-gray-400 underline underline-offset-2 transition-colors"
            >
              Sign out
            </button>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button className="w-full text-lg py-6" onClick={handlePlayNow} disabled={isLoading}>
          {isLoading ? "Loading..." : "Play Now"}
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push("/room/new")}
          disabled={isLoading}
        >
          Create Room
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/practice")}
          disabled={isLoading}
        >
          Practice
        </Button>

        {!user && (
          <Button variant="secondary" className="w-full" onClick={() => signIn("google")}>
            Sign in with Google
          </Button>
        )}
      </div>
    </main>
  );
}
