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
    players, raceProgress, rankings, serverStartAt, retireAt,
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

  // session.ok 후 방 입장
  useEffect(() => {
    if (myId && phase === "idle") {
      joinRoom(params.code.toUpperCase());
    }
  }, [myId, phase, params.code, joinRoom]);

  // 프롬프트 초기화
  useEffect(() => {
    if (promptText && roomId) init(roomId, promptText);
  }, [promptText, roomId, init]);

  // 카운트다운 (startCountdown/startRacing은 Zustand 액션으로 참조 안정)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase === "countdown" && serverStartAt) {
      seqRef.current = 0; // 새 게임마다 seq 초기화
      startCountdown();
      const remaining = serverStartAt - Date.now();
      // remaining <= 0이면 즉시 startRacing (GO! 화면 stuck 방지)
      if (remaining <= 0) {
        startRacing();
        return;
      }
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
      const kind = e.key === "Backspace" ? "backspace" : "type";
      const value = kind === "type" ? e.key : undefined;
      if (kind === "type" && value?.length !== 1) return;
      e.preventDefault();
      seqRef.current += 1;
      sendInput(seqRef.current, kind, value);
      handleKeyPress(e.key);
    }
    // IME 조합 완료 시 (한글 등) — 오타 피드백을 위해 처리
    function onCompositionEnd(e: CompositionEvent) {
      for (const char of e.data) {
        seqRef.current += 1;
        sendInput(seqRef.current, "type", char);
        handleKeyPress(char);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("compositionend", onCompositionEnd);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [racePhase, sendInput, handleKeyPress]);

  const isHost = myId === hostId;

  // 카운트다운 오버레이 (countdown phase에서만 실행)
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!serverStartAt || phase !== "countdown") return;
    const tick = () => setCountdown(Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [serverStartAt, phase]);

  // Retire 카운트다운 (1등 완주 후 10초)
  const [retireCountdown, setRetireCountdown] = useState(0);
  useEffect(() => {
    if (!retireAt) return;
    const tick = () => setRetireCountdown(Math.max(0, Math.ceil((retireAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [retireAt]);

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

  if (phase === "waiting") {
    const activePlayers = players.filter((p) => !p.isWaiting);
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-center">
          <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-1">Game in Progress</p>
          <h1 className="text-2xl font-bold">Waiting to join...</h1>
          <p className="text-gray-500 text-sm mt-1">You&apos;ll join the next round automatically</p>
        </div>

        {/* 현재 게임 진행 상황 (관전 모드) */}
        <div className="w-full max-w-sm space-y-3">
          {activePlayers.map((p) => {
            const prog = raceProgress.find((r) => r.participantId === p.participantId);
            const progress = prog?.progress ?? 0;
            const wpm = prog?.wpm ?? 0;
            return (
              <div key={p.participantId} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-white">{p.nickname}</span>
                  <span className="text-xs text-gray-500">{Math.round(wpm)} WPM</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(progress * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-gray-600 text-xs">
          <span className="font-mono font-bold text-gray-500">{roomCode}</span>
          <span>·</span>
          <span>Game ends soon</span>
        </div>

        <button
          onClick={() => { reset(); router.push("/"); }}
          className="text-gray-600 hover:text-gray-400 text-sm underline underline-offset-2 transition-colors"
        >
          Leave
        </button>
      </main>
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

  if ((phase === "racing" || (phase === "countdown" && (racePhase === "racing" || racePhase === "finished"))) && promptText) {
    return (
      <div ref={containerRef} tabIndex={-1} className="outline-none relative">
        {retireAt && (
          <div className="fixed top-0 inset-x-0 flex items-center justify-center pt-4 pointer-events-none z-40">
            <div className="bg-gray-950/60 backdrop-blur-md border border-indigo-500/30 rounded-2xl px-10 py-3 text-center shadow-lg shadow-indigo-900/20">
              <p className="text-indigo-300 text-xs font-medium tracking-widest uppercase mb-0.5">1st Place Finished</p>
              <p className="text-white font-bold text-3xl tabular-nums">
                {retireCountdown}
                <span className="text-indigo-400 text-lg font-normal ml-1">s</span>
              </p>
            </div>
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
        onNewRoom={() => router.push("/room/new")}
        onLeave={() => { reset(); router.push("/"); }}
      />
    );
  }

  return null;
}
