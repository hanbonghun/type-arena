// apps/web/components/room/lobby-view.tsx
"use client";
import { RoomPlayerPublic } from "@type-arena/shared";
import { Button } from "@/components/ui/button";

interface LobbyViewProps {
  roomCode: string;
  players: RoomPlayerPublic[];
  myId: string;
  isHost: boolean;
  onToggleReady: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyView({
  roomCode,
  players,
  myId,
  isHost,
  onToggleReady,
  onStart,
  onLeave,
}: LobbyViewProps) {
  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const myPlayer = players.find((p) => p.participantId === myId);
  const roomUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomCode}`
      : "";

  function copyLink() {
    navigator.clipboard.writeText(roomUrl);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-1">Waiting Room</h1>
        <div className="flex items-center gap-3 justify-center mt-3">
          <span className="text-2xl font-mono font-bold tracking-widest text-indigo-400">
            {roomCode}
          </span>
          <Button variant="secondary" className="text-xs px-3 py-1 h-auto" onClick={copyLink}>
            Copy Link
          </Button>
        </div>
        <p className="text-gray-500 text-sm mt-1">Share this code with friends</p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {players.map((p) => (
          <div
            key={p.participantId}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
          >
            <div className="flex items-center gap-2">
              {p.isHost && (
                <span className="text-xs text-yellow-400 font-semibold">HOST</span>
              )}
              <span className={p.participantId === myId ? "text-indigo-400 font-semibold" : "text-white"}>
                {p.nickname}
                {p.participantId === myId && " (You)"}
              </span>
            </div>
            <span
              className={`text-sm font-medium ${
                p.ready ? "text-green-400" : "text-gray-500"
              }`}
            >
              {p.ready ? "Ready" : "Not Ready"}
            </span>
          </div>
        ))}

        {players.length < 4 && (
          <div className="flex items-center justify-center bg-gray-900/40 border border-gray-800 border-dashed rounded-xl px-4 py-3">
            <span className="text-gray-600 text-sm">Waiting for players... ({players.length}/4)</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={onToggleReady} variant={myPlayer?.ready ? "secondary" : "primary"}>
          {myPlayer?.ready ? "Cancel Ready" : "Ready"}
        </Button>
        {isHost && (
          <Button onClick={onStart} disabled={!allReady}>
            Start Game
          </Button>
        )}
        <Button variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </main>
  );
}
