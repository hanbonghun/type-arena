// apps/ws-server/src/engine/input-judge.test.ts
import { describe, it, expect } from "vitest";
import {
  createJudgeState,
  applyInput,
} from "./input-judge";

const PROMPT = "Hello, world!";

describe("createJudgeState", () => {
  it("초기 상태는 cursorPos=0, hasMistake=false", () => {
    const state = createJudgeState();
    expect(state.cursorPos).toBe(0);
    expect(state.hasMistake).toBe(false);
    expect(state.correctChars).toBe(0);
    expect(state.finished).toBe(false);
  });
});

describe("applyInput — 정확한 입력", () => {
  it("정확한 문자 입력 시 cursorPos + correctChars 증가", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "H");
    expect(state.cursorPos).toBe(1);
    expect(state.correctChars).toBe(1);
    expect(state.hasMistake).toBe(false);
  });

  it("마지막 문자 입력 시 finished = true", () => {
    let state = createJudgeState();
    for (const char of PROMPT) {
      state = applyInput(state, PROMPT, "type", char);
    }
    expect(state.finished).toBe(true);
    expect(state.correctChars).toBe(PROMPT.length);
  });
});

describe("applyInput — 오입력", () => {
  it("틀린 문자 입력 시 hasMistake=true, cursorPos 변화 없음", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X"); // 'H' 가 맞는데 'X' 입력
    expect(state.hasMistake).toBe(true);
    expect(state.cursorPos).toBe(0);
    expect(state.incorrectKeystrokes).toBe(1);
  });

  it("mistake 상태에서 추가 입력은 incorrectKeystrokes만 증가", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X");
    state = applyInput(state, PROMPT, "type", "Y");
    expect(state.incorrectKeystrokes).toBe(2);
    expect(state.cursorPos).toBe(0);
  });
});

describe("applyInput — Backspace", () => {
  it("mistake 상태에서 Backspace → hasMistake=false", () => {
    let state = createJudgeState();
    state = applyInput(state, PROMPT, "type", "X");
    state = applyInput(state, PROMPT, "backspace", undefined);
    expect(state.hasMistake).toBe(false);
    expect(state.cursorPos).toBe(0);
  });

  it("mistake 없을 때 Backspace → 상태 변화 없음", () => {
    const state = createJudgeState();
    const next = applyInput(state, PROMPT, "backspace", undefined);
    expect(next.cursorPos).toBe(0);
    expect(next.hasMistake).toBe(false);
  });
});

describe("applyInput — 공백 문자 처리", () => {
  const SPACE_PROMPT = "hi there";

  it("공백 문자도 정확히 일치해야 진행", () => {
    let state = createJudgeState();
    state = applyInput(state, SPACE_PROMPT, "type", "h");
    state = applyInput(state, SPACE_PROMPT, "type", "i");
    state = applyInput(state, SPACE_PROMPT, "type", " ");
    expect(state.cursorPos).toBe(3);
    expect(state.correctChars).toBe(3);
  });
});

describe("applyInput — 완료 후 입력", () => {
  it("finished 상태에서는 추가 입력 무시", () => {
    let state = createJudgeState();
    for (const char of PROMPT) {
      state = applyInput(state, PROMPT, "type", char);
    }
    const before = { ...state };
    state = applyInput(state, PROMPT, "type", "X");
    expect(state.correctChars).toBe(before.correctChars);
    expect(state.cursorPos).toBe(before.cursorPos);
  });
});
