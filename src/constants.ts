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
  STORE_MAX_IDS: 500,
} as const;

export const DELAYS = {
  POPUP: { min: 800, max: 2000 },
  SCROLL: { min: 2000, max: 4000 },
  BETWEEN_ARTICLES: { min: 300, max: 800 },
} as const;
