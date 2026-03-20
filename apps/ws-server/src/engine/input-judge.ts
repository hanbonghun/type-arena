// apps/ws-server/src/engine/input-judge.ts
// placeholder — will be implemented in Task 6

export interface JudgeState {
  cursorPos: number;
  hasMistake: boolean;
  correctChars: number;
  incorrectKeystrokes: number;
  totalKeystrokes: number;
  finished: boolean;
}

export function createJudgeState(): JudgeState {
  return {
    cursorPos: 0,
    hasMistake: false,
    correctChars: 0,
    incorrectKeystrokes: 0,
    totalKeystrokes: 0,
    finished: false,
  };
}

export function applyInput(
  state: JudgeState,
  _promptText: string,
  _kind: "type" | "backspace",
  _value?: string
): JudgeState {
  return state; // placeholder
}
