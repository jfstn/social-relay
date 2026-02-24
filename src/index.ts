import { config } from "./config.js";
import { scrapePage, FacebookPost } from "./scraper.js";
import { sendMessage, sendPhoto } from "./telegram.js";
import { wasSent, markSent } from "./store.js";
import { TIMEOUTS } from "./constants.js";

let lastBlockWarning = 0;

function timestamp(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: config.timezone,
    hour12: false,
  });
}

function pageLabel(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

function jitteredInterval(): number {
  const base = config.checkIntervalMinutes;
  const jitter = base * 0.3;
  const minutes = base + (Math.random() * 2 - 1) * jitter;
  return Math.round(minutes * 60 * 1000);
}

function msUntilActive(): number {
  const { nightSleepStart, nightSleepEnd } = config;
  if (nightSleepStart === nightSleepEnd) return 0;

  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: config.timezone }));
  const hour = local.getHours();

  const isSleeping = nightSleepStart < nightSleepEnd
    ? hour >= nightSleepStart && hour < nightSleepEnd
    : hour >= nightSleepStart || hour < nightSleepEnd;

  if (isSleeping) {
    const wake = new Date(local);
    wake.setHours(nightSleepEnd, Math.floor(Math.random() * 30), 0, 0);
    if (wake.getTime() <= local.getTime()) {
      wake.setDate(wake.getDate() + 1);
    }
    return wake.getTime() - local.getTime();
  }
  return 0;
}

async function handleBlockWarning() {
  const now = Date.now();
  if (now - lastBlockWarning > TIMEOUTS.BLOCK_WARNING_COOLDOWN) {
    lastBlockWarning = now;
    await sendMessage(
      "Facebook is redirecting to login. Scraping may be blocked from this IP.",
      undefined,
      "Bot Warning"
    ).catch((err) => console.error("Failed to send block warning:", err));
  }
}

async function processPost(post: FacebookPost) {
  const link = post.link ?? undefined;
  const name = post.pageName || undefined;

  if (post.images.length > 0) {
    try {
      await sendPhoto(post.images[0], post.text, link, name);
    } catch {
      await sendMessage(post.text, link, name);
    }
  } else {
    await sendMessage(post.text, link, name);
  }

  markSent(post.id);
  await new Promise((r) => setTimeout(r, TIMEOUTS.POST_DELAY));
}

async function check() {
  const pages = config.pages;
  console.log(
    `\n[${timestamp()}] Checking ${pages.length} page${pages.length > 1 ? "s" : ""}...`
  );

  let totalNew = 0;

  for (const url of pages) {
    const label = pageLabel(url);

    try {
      const { posts, blocked, elementCount } = await scrapePage(url);

      if (blocked) {
        console.warn(`  [${label}] blocked — redirected to login`);
        await handleBlockWarning();
        continue;
      }

      let newCount = 0;

      for (const post of posts.reverse()) {
        if (wasSent(post.id)) continue;
        newCount++;
        await processPost(post);
      }

      totalNew += newCount;
      console.log(
        `  [${label}] ${elementCount} elements, ${posts.length} posts, ${newCount} new`
      );
    } catch (err) {
      console.error(`  [${label}] Error:`, err);
    }
  }

  if (totalNew > 0) {
    console.log(`  Sent ${totalNew} new post(s)`);
  }
}

function scheduleNext() {
  const sleep = msUntilActive();
  if (sleep > 0) {
    console.log(
      `Night time — sleeping ${(sleep / 1000 / 60 / 60).toFixed(1)}h until ${config.nightSleepEnd}:00`
    );
    setTimeout(() => scheduleNext(), sleep);
    return;
  }

  const ms = jitteredInterval();
  console.log(`Next check in ${(ms / 1000 / 60).toFixed(1)} minutes`);
  setTimeout(async () => {
    await check();
    scheduleNext();
  }, ms);
}

async function main() {
  console.log("Social Relay starting (Facebook → Telegram)");
  console.log(`Pages: ${config.pages.join(", ")}`);
  console.log(
    `Interval: ~${config.checkIntervalMinutes} minutes (±30% jitter)`
  );
  if (config.nightSleepStart !== config.nightSleepEnd) {
    console.log(
      `Night sleep: ${config.nightSleepStart}:00–${config.nightSleepEnd}:00 ${config.timezone}`
    );
  } else {
    console.log("Night sleep: disabled");
  }

  await check();
  scheduleNext();
}

function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
