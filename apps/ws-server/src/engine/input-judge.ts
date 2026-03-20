// apps/ws-server/src/engine/input-judge.ts

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

/**
 * 단일 입력 이벤트를 적용해 새 JudgeState를 반환 (순수 함수 — 불변).
 * 기능정의서 5.2절 판정 규칙 구현.
 */
export function applyInput(
  state: JudgeState,
  promptText: string,
  kind: "type" | "backspace",
  value?: string
): JudgeState {
  // 완료 후 입력 무시
  if (state.finished) return state;

  // Backspace 처리
  if (kind === "backspace") {
    if (state.hasMistake) {
      return { ...state, hasMistake: false };
    }
    return state; // mistake 없을 때 backspace는 무시
  }

  // 단일 문자만 허용
  if (!value || value.length !== 1) return state;

  const newTotal = state.totalKeystrokes + 1;

  // mistake 상태에서 추가 입력 — incorrectKeystrokes만 증가
  if (state.hasMistake) {
    return {
      ...state,
      totalKeystrokes: newTotal,
      incorrectKeystrokes: state.incorrectKeystrokes + 1,
    };
  }

  const expected = promptText[state.cursorPos];

  if (value === expected) {
    const newCorrect = state.correctChars + 1;
    const newPos = state.cursorPos + 1;
    const finished = newPos >= promptText.length;
    return {
      ...state,
      cursorPos: newPos,
      correctChars: newCorrect,
      totalKeystrokes: newTotal,
      finished,
    };
  } else {
    return {
      ...state,
      hasMistake: true,
      totalKeystrokes: newTotal,
      incorrectKeystrokes: state.incorrectKeystrokes + 1,
    };
  }
}
