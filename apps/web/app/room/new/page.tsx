// apps/web/app/room/new/page.tsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRoomStore } from "@/lib/stores/room-store";
import { useSession } from "next-auth/react";

const GUEST_SESSION_KEY = "type_arena_guest";

interface GuestSession {
  id: string; nickname: string; token: string; expiresAt: string;
}

function getStoredGuest(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GuestSession;
    if (new Date(g.expiresAt) < new Date()) { localStorage.removeItem(GUEST_SESSION_KEY); return null; }
    return g;
  } catch { return null; }
}

export default function RoomNewPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { connectAndAuth, createRoom, roomCode, phase, myId } = useRoomStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (status === "loading" || initialized.current) return;
    initialized.current = true;

    async function initWs() {
      let token: string | null = null;
      if (session?.user) {
        const res = await fetch("/api/v1/auth/ws-token");
        if (!res.ok) { router.replace("/"); return; }
        const data = await res.json() as { token: string };
        token = data.token;
      } else {
        let guest = getStoredGuest();
        if (!guest) {
          const res = await fetch("/api/v1/guest-sessions", { method: "POST" });
          if (!res.ok) { router.replace("/"); return; }
          guest = await res.json() as GuestSession;
          localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guest));
        }
        token = guest.token;
      }
      connectAndAuth(token);
    }
    initWs().catch(console.error);
  }, [status]);

  // session.ok 받은 후 방 생성 (myId가 설정되면 실행)
  useEffect(() => {
    if (myId && phase === "idle") {
      createRoom();
    }
  }, [myId, phase, createRoom]);

  // 방 생성 완료 → 코드로 이동
  useEffect(() => {
    if (phase === "lobby" && roomCode) {
      router.replace(`/room/${roomCode}`);
    }
  }, [phase, roomCode, router]);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400 text-xl">Creating room...</p>
    </main>
  );
}
