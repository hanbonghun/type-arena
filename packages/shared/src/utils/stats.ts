import { CHARS_PER_WORD } from "../constants/game-rules";

/**
 * WPM 계산. 기능정의서 5.4절:
 * wpm = (correct_chars / 5) / (elapsed_seconds / 60)
 */
export function calcWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const elapsedMin = elapsedMs / 60_000;
  return correctChars / CHARS_PER_WORD / elapsedMin;
}

/**
 * 정확도 계산. 기능정의서 5.4절:
 * accuracy = correct / (correct + incorrect) * 100
 */
export function calcAccuracy(
  correctKeystrokes: number,
  incorrectKeystrokes: number
): number {
  const total = correctKeystrokes + incorrectKeystrokes;
  if (total === 0) return 0;
  return (correctKeystrokes / total) * 100;
}

/**
 * 진행률 계산. 기능정의서 5.4절:
 * progress = correct_chars / total_prompt_chars
 */
export function calcProgress(
  correctChars: number,
  totalPromptChars: number
): number {
  if (totalPromptChars <= 0) return 0;
  return correctChars / totalPromptChars;
}
