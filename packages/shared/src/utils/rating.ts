import {
  K_PROVISIONAL,
  K_NORMAL,
  PROVISIONAL_GAMES,
  TIERS,
} from "../constants/game-rules";
import type { TierName } from "../schemas/game";

/**
 * RS 변동 계산. 기능정의서 6.2절:
 * expected = 1 / (1 + 10^((opponent - my) / 400))
 * k = 48 if games < 10 else 32
 * delta = round(k * (actual - expected))
 */
export function calcRatingDelta(
  myRs: number,
  opponentRs: number,
  actual: number, // 1=승, 0=패, 0.5=무승부
  rankedGames: number
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRs - myRs) / 400));
  const k = rankedGames < PROVISIONAL_GAMES ? K_PROVISIONAL : K_NORMAL;
  return Math.round(k * (actual - expected));
}

/**
 * RS로 티어 이름 반환. 기능정의서 6.3절.
 */
export function getTierForRs(rs: number): TierName {
  for (const tier of TIERS) {
    if (rs >= tier.min && rs <= tier.max) {
      return tier.name;
    }
  }
  return "Bronze";
}
