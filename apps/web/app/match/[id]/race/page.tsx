// apps/web/app/match/[id]/race/page.tsx
"use client";
import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMatchStore } from "@/lib/stores/match-store";
import { PromptDisplay } from "@/components/race/prompt-display";
import { ProgressBar } from "@/components/race/progress-bar";
import { OpponentProgress } from "@/components/race/opponent-progress";
import { useRaceStore } from "@/lib/stores/race-store";

export default function MatchRacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    phase,
    matchId,
    promptText,
    opponentNickname,
    selfProgress,
    selfWpm,
    selfAccuracy,
    opponentProgress,
    opponentWpm,
    serverStartAt,
    sendInput,
  } = useMatchStore();

  // 로컬 race-store는 프롬프트 표시/커서 추적에만 사용 (optimistic)
  const { init, handleKeyPress, startRacing, startCountdown } = useRaceStore();
  const seqRef = useRef(0);

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

  // 키보드 입력 캡처 + WS 전송
  useEffect(() => {
    if (phase !== "racing" || !matchId) return;

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
  }, [phase, matchId, sendInput, handleKeyPress]);

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
    <main className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
      {phase === "countdown" && serverStartAt && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-950/80 z-50">
          <CountdownDisplay serverStartAt={serverStartAt} />
        </div>
      )}

      <div className="w-full max-w-3xl space-y-4">
        {/* 내 진행률 */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>You</span>
            <span>
              {Math.round(selfWpm)} WPM · {selfAccuracy.toFixed(1)}%
            </span>
          </div>
          <ProgressBar />
        </div>

        {/* 상대 진행률 */}
        <OpponentProgress
          progress={opponentProgress}
          wpm={opponentWpm}
          nickname={opponentNickname}
        />

        {/* 프롬프트 */}
        <PromptDisplay />
      </div>
    </main>
  );
}

// 서버 기준 카운트다운 숫자 표시
function CountdownDisplay({ serverStartAt }: { serverStartAt: number }) {
  const remaining = Math.max(0, Math.ceil((serverStartAt - Date.now()) / 1000));
  return (
    <span className="text-8xl font-bold text-indigo-400 animate-pulse">
      {remaining > 0 ? remaining : "GO!"}
    </span>
  );
}
