// apps/web/app/match/[id]/race/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMatchStore } from "@/lib/stores/match-store";
import { PromptDisplay } from "@/components/race/prompt-display";
import { ProgressBar } from "@/components/race/progress-bar";
import { useRaceStore } from "@/lib/stores/race-store";

export default function MatchRacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    phase,
    matchId,
    promptText,
    opponentNickname,
    selfWpm,
    selfAccuracy,
    opponentProgress,
    opponentWpm,
    serverStartAt,
    sendInput,
  } = useMatchStore();

  // 로컬 race-store: 커서 추적 + 즉각적인 로컬 게이지 업데이트 (optimistic)
  const { init, handleKeyPress, startRacing, startCountdown, phase: racePhase } = useRaceStore();
  const seqRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 프롬프트 초기화
  useEffect(() => {
    if (promptText && matchId) {
      init(matchId, promptText);
    }
  }, [promptText, matchId, init]);

  // 카운트다운 시작
  useEffect(() => {
    if (phase === "countdown" && serverStartAt) {
      const now = Date.now();
      const remaining = serverStartAt - now;
      startCountdown();
      const timer = setTimeout(() => {
        startRacing();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [phase, serverStartAt, startCountdown, startRacing]);

  // 레이스 시작 시 페이지에 포커스 강제 이동 (브라우저 탭/주소창 포커스 방지)
  useEffect(() => {
    if (racePhase === "racing") {
      containerRef.current?.focus();
    }
  }, [racePhase]);

  // 키보드 입력 캡처 + WS 전송 (race-store phase 기준: 클라이언트 타이머로 전환)
  useEffect(() => {
    if (racePhase !== "racing" || !matchId) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.isComposing) return;
      e.preventDefault();

      const kind = e.key === "Backspace" ? "backspace" : "type";
      const value = kind === "type" ? e.key : undefined;
      if (kind === "type" && (value?.length !== 1)) return;

      seqRef.current += 1;
      sendInput(matchId!, seqRef.current, kind, value);
      handleKeyPress(e.key); // optimistic 로컬 업데이트
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [racePhase, matchId, sendInput, handleKeyPress]);

  // 결과 화면으로 이동
  useEffect(() => {
    if (phase === "finished" && matchId) {
      router.push(`/match/${matchId}/result`);
    }
  }, [phase, matchId, router]);

  if (!matchId || params.id !== matchId) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading match...</p>
      </main>
    );
  }

  return (
    <main
      ref={containerRef}
      tabIndex={-1}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 gap-4 outline-none"
    >
      {racePhase !== "racing" && serverStartAt && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
          <CountdownDisplay serverStartAt={serverStartAt} />
        </div>
      )}

      {/* 두 플레이어 나란히 (테트리스 스타일) */}
      <div className="w-full max-w-6xl flex gap-4 items-start">

        {/* 내 화면 (왼쪽, 크게) */}
        <div className="flex-1 flex flex-col gap-3">
          {/* 내 헤더 */}
          <div className="flex justify-between items-center text-sm text-gray-400">
            <span className="font-semibold text-indigo-400">You</span>
            <span>{Math.round(selfWpm)} WPM · {selfAccuracy.toFixed(1)}%</span>
          </div>

          {/* 내 progress bar */}
          <ProgressBar />

          {/* 내 프롬프트 */}
          <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-800">
            <PromptDisplay />
          </div>
        </div>

        {/* 구분선 */}
        <div className="w-px bg-gray-800 self-stretch mt-8" />

        {/* 상대 화면 (오른쪽, 작게) */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 pt-0">
          <OpponentTypingView
            promptText={promptText}
            progress={opponentProgress}
            wpm={opponentWpm}
            nickname={opponentNickname}
          />
        </div>
      </div>
    </main>
  );
}

// 상대방 타이핑 뷰 (커서 위치 시각화)
function OpponentTypingView({
  promptText,
  progress,
  wpm,
  nickname,
}: {
  promptText: string;
  progress: number;
  wpm: number;
  nickname: string;
}) {
  const cursorPos = Math.round(progress * promptText.length);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span className="font-medium text-rose-400">{nickname}</span>
        <span>{Math.round(wpm)} WPM</span>
      </div>
      <div className="text-sm leading-relaxed font-mono select-none bg-gray-900/60 rounded-lg p-3 border border-gray-800">
        {promptText.split("").map((char, i) => {
          let className = "text-gray-600";
          if (i < cursorPos) className = "text-rose-400/80";
          else if (i === cursorPos) className = "bg-rose-900/50 text-rose-200";
          return (
            <span key={i} className={className}>
              {char === " " && i === cursorPos ? "\u00B7" : char}
            </span>
          );
        })}
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1">
        <div
          className="bg-rose-500 h-1 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// 서버 기준 카운트다운 숫자 표시 (200ms마다 업데이트)
function CountdownDisplay({ serverStartAt }: { serverStartAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000)));
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [serverStartAt]);

  return (
    <span className="text-8xl font-bold text-indigo-400 animate-pulse">
      {remaining > 0 ? remaining : "GO!"}
    </span>
  );
}
