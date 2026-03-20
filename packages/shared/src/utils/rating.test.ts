import { describe, it, expect } from "vitest";
import { calcRatingDelta, getTierForRs } from "./rating";

describe("calcRatingDelta", () => {
  it("동일 RS 승리: K=32이면 +16", () => {
    const delta = calcRatingDelta(1000, 1000, 1, 20);
    // expected = 0.5, delta = 32 * (1 - 0.5) = 16
    expect(delta).toBe(16);
  });

  it("동일 RS 패배: K=32이면 -16", () => {
    const delta = calcRatingDelta(1000, 1000, 0, 20);
    expect(delta).toBe(-16);
  });

  it("provisional이면 K=48 사용", () => {
    const delta = calcRatingDelta(1000, 1000, 1, 5);
    // K=48, delta = 48 * 0.5 = 24
    expect(delta).toBe(24);
  });

  it("약자가 강자를 이기면 큰 보상", () => {
    const delta = calcRatingDelta(800, 1200, 1, 20);
    expect(delta).toBeGreaterThan(20);
  });
});

describe("getTierForRs", () => {
  it("Bronze: RS 500", () => {
    expect(getTierForRs(500)).toBe("Bronze");
  });

  it("Silver: RS 1000", () => {
    expect(getTierForRs(1000)).toBe("Silver");
  });

  it("Diamond: RS 1500", () => {
    expect(getTierForRs(1500)).toBe("Diamond");
  });
});
