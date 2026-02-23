export interface Config {
  telegramBotToken: string;
  telegramChatId: string;
  pages: string[];
  checkIntervalMinutes: number;
  timezone: string;
  nightSleepStart: number; // 0-23, hour to start sleeping
  nightSleepEnd: number;   // 0-23, hour to wake up (set equal to start to disable)
  language: string;
  debug: boolean;
}

export const SUPPORTED_LANGUAGES = ["en", "pt"] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config: Config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChatId: required("TELEGRAM_CHAT_ID"),
  pages: required("FACEBOOK_PAGES")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || "30", 10),
  timezone: process.env.TIMEZONE || "UTC",
  nightSleepStart: parseInt(process.env.NIGHT_SLEEP_START || "0", 10),
  nightSleepEnd: parseInt(process.env.NIGHT_SLEEP_END || "8", 10),
  language: process.env.BOT_LANGUAGE || "en",
  debug: process.env.DEBUG === "1",
};

if (config.pages.length === 0) {
  console.error("FACEBOOK_PAGES must contain at least one URL");
  process.exit(1);
}

if (!SUPPORTED_LANGUAGES.includes(config.language as any)) {
  console.error(
    `Unsupported BOT_LANGUAGE "${config.language}". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`
  );
  process.exit(1);
}
