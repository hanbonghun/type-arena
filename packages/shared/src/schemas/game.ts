import { z } from "zod";

export const MatchMode = z.enum(["ranked", "private", "practice"]);
export type MatchMode = z.infer<typeof MatchMode>;

export const MatchState = z.enum([
  "loading",
  "countdown",
  "racing",
  "finish_wait",
  "completed",
  "aborted",
  "forfeit",
]);
export type MatchState = z.infer<typeof MatchState>;

export const OutcomeType = z.enum([
  "completion",
  "timeout",
  "forfeit",
  "draw",
  "no_result",
]);
export type OutcomeType = z.infer<typeof OutcomeType>;

export const TierName = z.enum([
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
]);
export type TierName = z.infer<typeof TierName>;

/** 솔로 연습 결과 (클라이언트 로컬 계산) */
export const PracticeResult = z.object({
  promptId: z.string(),
  promptText: z.string(),
  correctChars: z.number().int().nonnegative(),
  totalKeystrokes: z.number().int().nonnegative(),
  elapsedMs: z.number().int().positive(),
  finished: z.boolean(),
});
export type PracticeResult = z.infer<typeof PracticeResult>;
