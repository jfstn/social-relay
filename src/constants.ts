export const TIMEOUTS = {
  BROWSER: 60_000,
  CLICK: 3_000,
  BLOCK_WARNING_COOLDOWN: 60 * 60 * 1000,
  POST_DELAY: 1_000,
} as const;

export const LIMITS = {
  TELEGRAM_MESSAGE: 4096,
  TELEGRAM_CAPTION: 1024,
  MIN_POST_TEXT: 30,
  MIN_CLEANED_TEXT: 10,
  MAX_POSTS: 10,
  MAX_IMAGES: 4,
  STORE_MAX_IDS: 1000,
} as const;

export const DELAYS = {
  POPUP: { min: 800, max: 2000 },
  SCROLL: { min: 2000, max: 4000 },
  BETWEEN_ARTICLES: { min: 300, max: 800 },
} as const;

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
] as const;
