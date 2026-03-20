// apps/web/app/room/[code]/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRoomStore } from "@/lib/stores/room-store";
import { useRaceStore } from "@/lib/stores/race-store";
import { LobbyView } from "@/components/room/lobby-view";
import { RoomRaceView } from "@/components/room/room-race-view";
import { RoomResultView } from "@/components/room/room-result-view";

const GUEST_SESSION_KEY = "type_arena_guest";
interface GuestSession { id: string; nickname: string; token: string; expiresAt: string; }
function getStoredGuest(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as GuestSession;
    if (new Date(g.expiresAt) < new Date()) { localStorage.removeItem(GUEST_SESSION_KEY); return null; }
    return g;
  } catch { return null; }
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    phase, roomId, roomCode, promptText, hostId, myId,
    players, raceProgress, rankings, serverStartAt,
    connectAndAuth, joinRoom, toggleReady, startRoom, sendInput, reset,
  } = useRoomStore();
  const {
    init, handleKeyPress, startRacing, startCountdown,
    phase: racePhase, wpm: selfWpm, accuracy: selfAccuracy,
  } = useRaceStore();

  const initialized = useRef(false);
  const seqRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // WS 연결 + 방 입장
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
          guest = await res.json() as GuestSession;
          localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guest));
        }
        token = guest.token;
      }
      connectAndAuth(token);
    }
    initWs().catch(console.error);
  }, [status]);

  // session.ok 후 방 입장
  useEffect(() => {
    if (myId && phase === "idle") {
      joinRoom(params.code.toUpperCase());
    }
  }, [myId, params.code]);

  // 프롬프트 초기화
  useEffect(() => {
    if (promptText && roomId) init(roomId, promptText);
  }, [promptText, roomId, init]);

  // 카운트다운
  useEffect(() => {
    if (phase === "countdown" && serverStartAt) {
      startCountdown();
      const remaining = serverStartAt - Date.now();
      const timer = setTimeout(() => startRacing(), remaining);
      return () => clearTimeout(timer);
    }
  }, [phase, serverStartAt]);

  // 레이스 시작 시 포커스
  useEffect(() => {
    if (racePhase === "racing") containerRef.current?.focus();
  }, [racePhase]);

  // 키보드 입력
  useEffect(() => {
    if (racePhase !== "racing") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.isComposing) return;
      e.preventDefault();
      const kind = e.key === "Backspace" ? "backspace" : "type";
      const value = kind === "type" ? e.key : undefined;
      if (kind === "type" && value?.length !== 1) return;
      seqRef.current += 1;
      sendInput(seqRef.current, kind, value);
      handleKeyPress(e.key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [racePhase, sendInput, handleKeyPress]);

  const isHost = myId === hostId;

  // 카운트다운 오버레이
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!serverStartAt) return;
    const tick = () => setCountdown(Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [serverStartAt]);

  if (phase === "idle" || (phase === "countdown" && racePhase !== "racing")) {
    return (
      <div ref={containerRef} tabIndex={-1} className="outline-none">
        {phase === "idle" && (
          <main className="flex items-center justify-center min-h-screen">
            <p className="text-gray-400 text-xl">Connecting...</p>
          </main>
        )}
        {phase === "countdown" && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
            <span className="text-8xl font-bold text-indigo-400 animate-pulse">
              {countdown > 0 ? countdown : "GO!"}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <LobbyView
        roomCode={roomCode ?? ""}
        players={players}
        myId={myId ?? ""}
        isHost={isHost}
        onToggleReady={toggleReady}
        onStart={startRoom}
        onLeave={() => { reset(); router.push("/"); }}
      />
    );
  }

  if (phase === "racing" || (phase === "countdown" && racePhase === "racing")) {
    return (
      <div ref={containerRef} tabIndex={-1} className="outline-none">
        {phase === "countdown" && racePhase !== "racing" && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
            <span className="text-8xl font-bold text-indigo-400 animate-pulse">
              {countdown > 0 ? countdown : "GO!"}
            </span>
          </div>
        )}
        <RoomRaceView
          myId={myId ?? ""}
          promptText={promptText}
          raceProgress={raceProgress}
          players={players}
          selfWpm={selfWpm}
          selfAccuracy={selfAccuracy}
        />
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <RoomResultView
        rankings={rankings}
        myId={myId ?? ""}
        onPlayAgain={() => router.push("/room/new")}
        onLeave={() => { reset(); router.push("/"); }}
      />
    );
  }

  return null;
}
