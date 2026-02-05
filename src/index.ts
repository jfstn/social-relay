import { scrapePage } from "./scraper.js";
import { sendMessage, sendPhoto } from "./telegram.js";
import { wasSent, markSent } from "./store.js";

const PAGE_URL =
  process.env.FACEBOOK_PAGE_URL || "https://www.facebook.com/jfcaranguejeira";
const BASE_INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MINUTES || "30", 10);

function jitteredInterval(): number {
  // +/- 30% of base interval
  const jitter = BASE_INTERVAL_MIN * 0.3;
  const minutes = BASE_INTERVAL_MIN + (Math.random() * 2 - 1) * jitter;
  return Math.round(minutes * 60 * 1000);
}

function msUntilActive(): number {
  const now = new Date(Date.now() + 0); // UTC
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const hour = pt.getHours();

  if (hour >= 0 && hour < 8) {
    // Sleep until 8:00 PT
    const wake = new Date(pt);
    wake.setHours(8, Math.floor(Math.random() * 30), 0, 0); // 8:00-8:30
    return wake.getTime() - pt.getTime();
  }
  return 0;
}

function scheduleNext() {
  const sleep = msUntilActive();
  if (sleep > 0) {
    console.log(`Night time in PT — sleeping ${(sleep / 1000 / 60 / 60).toFixed(1)}h until 8am`);
    setTimeout(() => {
      scheduleNext();
    }, sleep);
    return;
  }

  const ms = jitteredInterval();
  console.log(`Next check in ${(ms / 1000 / 60).toFixed(1)} minutes`);
  setTimeout(async () => {
    await check();
    scheduleNext();
  }, ms);
}

async function check() {
  console.log(`[${new Date().toISOString()}] Checking ${PAGE_URL}...`);

  try {
    const posts = await scrapePage(PAGE_URL);
    console.log(`Found ${posts.length} posts`);

    let newCount = 0;
    // Process in reverse so oldest new posts are sent first
    for (const post of posts.reverse()) {
      if (wasSent(post.id)) continue;

      newCount++;
      console.log(`New post: ${post.text.slice(0, 80)}...`);

      const link = post.link ?? undefined;
      const name = post.pageName || undefined;

      if (post.images.length > 0) {
        try {
          if (post.text.length <= 800) {
            await sendPhoto(post.images[0], post.text, link, name);
          } else {
            await sendPhoto(post.images[0]);
            await sendMessage(post.text, link, name);
          }
        } catch {
          await sendMessage(post.text, link, name);
        }
      } else {
        await sendMessage(post.text, link, name);
      }

      markSent(post.id);

      // Small delay between messages to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`Sent ${newCount} new post(s)`);
  } catch (err) {
    console.error("Error during check:", err);
  }
}

async function main() {
  console.log(`FB Telegram Bot starting`);
  console.log(`Page: ${PAGE_URL}`);
  console.log(`Interval: ~${BASE_INTERVAL_MIN} minutes (±30% jitter)`);

  // Run immediately on start
  await check();

  // Schedule with random jitter
  scheduleNext();
}

main();
