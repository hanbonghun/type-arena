import { describe, it, expect } from "vitest";
import { calcWpm, calcAccuracy, calcProgress } from "./stats";

describe("calcWpm", () => {
  it("정상 케이스: 100자 60초 = 20 WPM", () => {
    expect(calcWpm(100, 60_000)).toBeCloseTo(20);
  });

  it("0초면 0 반환", () => {
    expect(calcWpm(100, 0)).toBe(0);
  });
});

describe("calcAccuracy", () => {
  it("100% 정확도", () => {
    expect(calcAccuracy(50, 0)).toBe(100);
  });

  it("80% 정확도: 40 correct, 10 incorrect", () => {
    expect(calcAccuracy(40, 10)).toBe(80);
  });

  it("입력 없으면 0 반환", () => {
    expect(calcAccuracy(0, 0)).toBe(0);
  });
});

describe("calcProgress", () => {
  it("절반 완료", () => {
    expect(calcProgress(50, 100)).toBeCloseTo(0.5);
  });

  it("프롬프트 길이 0이면 0 반환", () => {
    expect(calcProgress(0, 0)).toBe(0);
  });
});
