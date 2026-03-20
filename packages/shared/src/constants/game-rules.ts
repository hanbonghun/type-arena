/** 경기 최대 시간 (ms) */
export const MATCH_TIMEOUT_MS = 120_000;

/** 카운트다운 시간 (ms) */
export const COUNTDOWN_MS = 3_000;

/** 클라이언트 로딩 대기 시간 (ms) */
export const LOADING_TIMEOUT_MS = 10_000;

/** 연결 끊김 재연결 유예 시간 (ms) */
export const RECONNECT_GRACE_MS = 10_000;

/** 무응답 패배 처리 시간 (ms) — 경기 시작 후 30초간 정확한 입력 0개 */
export const INACTIVITY_FORFEIT_MS = 30_000;

/** 방 무활동 만료 시간 (ms) */
export const ROOM_EXPIRE_MS = 30 * 60 * 1000;

/** 초기 RS */
export const INITIAL_RS = 1000;

/** Provisional 경기 수 */
export const PROVISIONAL_GAMES = 10;

/** Elo K값: provisional */
export const K_PROVISIONAL = 48;

/** Elo K값: 일반 */
export const K_NORMAL = 32;

/** 매칭 큐 타임아웃 (ms) */
export const QUEUE_TIMEOUT_MS = 60_000;

/** 프롬프트 권장 길이 (단어) */
export const PROMPT_MIN_WORDS = 35;
export const PROMPT_MAX_WORDS = 55;

/** WPM 계산 기준: 1 word = 5 chars */
export const CHARS_PER_WORD = 5;

/** 티어 구간 */
export const TIERS = [
  { name: "Bronze", min: 0, max: 899 },
  { name: "Silver", min: 900, max: 1099 },
  { name: "Gold", min: 1100, max: 1299 },
  { name: "Platinum", min: 1300, max: 1499 },
  { name: "Diamond", min: 1500, max: Infinity },
] as const;

/** 비공개 방 초대 코드 길이 */
export const INVITE_CODE_LENGTH = 6;
