import { chromium } from "playwright-extra";
import type { Page, BrowserContext, Locator } from "playwright";
import stealth from "puppeteer-extra-plugin-stealth";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { config } from "./config.js";
import { TIMEOUTS, LIMITS, DELAYS, USER_AGENTS } from "./constants.js";

chromium.use(stealth());

export interface FacebookPost {
  id: string;
  text: string;
  link: string | null;
  images: string[];
  pageName: string;
}

export interface ScrapeResult {
  posts: FacebookPost[];
  blocked: boolean;
  pageName: string;
  elementCount: number;
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

const MAX_DEBUG_FILES = 50;

function dumpDebug(label: string, content: string) {
  if (!config.debug) return;
  const dir = "./data/debug";
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${label}-${Date.now()}.html`;
  writeFileSync(file, content);
  console.log(`[debug] Saved ${file}`);

  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".html"))
      .sort();
    if (files.length > MAX_DEBUG_FILES) {
      for (const old of files.slice(0, files.length - MAX_DEBUG_FILES)) {
        unlinkSync(`${dir}/${old}`);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

function cleanPostText(raw: string, pageName: string): string {
  let text = raw;

  if (pageName) {
    const headerPattern = new RegExp(
      `^${pageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n.*?\\n+\\.?\\n*`,
      "i"
    );
    text = text.replace(headerPattern, "");
  }

  text = text.replace(/^\d+\s*(h|d|m|s|min|hr|hrs)\b[^\n]*\n?[\s·.]*/gim, "");
  text = text.replace(/^(Just now|Yesterday)\n?[\s·.]*/gim, "");
  text = text.replace(/\n*All reactions:[\s\S]*$/i, "");
  text = text.replace(/\n*Like\n+Comment(\n+Share)?[\s\S]*$/i, "");
  text = text.replace(/\s*See more\s*/gi, "");
  text = text.replace(/^[·.]\s*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function contentFingerprint(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function cleanFacebookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const keep = ["story_fbid", "id", "fbid", "set"];
    const cleaned = new URL(parsed.origin + parsed.pathname);
    for (const key of keep) {
      const val = parsed.searchParams.get(key);
      if (val) cleaned.searchParams.set(key, val);
    }
    return cleaned.toString();
  } catch {
    return url;
  }
}

async function dismissPopups(page: Page) {
  try {
    const cookieBtn = page.locator(
      'button:has-text("Allow all cookies"), button:has-text("Decline optional cookies"), ' +
      '[data-cookiebanner="accept_button"]'
    );
    await cookieBtn.first().click({ timeout: TIMEOUTS.CLICK });
    await page.waitForTimeout(randomDelay(DELAYS.POPUP.min, DELAYS.POPUP.max));
  } catch {
    // No cookie banner
  }

  try {
    const closeBtn = page.locator('div[role="dialog"] button[aria-label="Close"]');
    await closeBtn.first().click({ timeout: TIMEOUTS.CLICK });
    await page.waitForTimeout(randomDelay(DELAYS.POPUP.min, DELAYS.POPUP.max));
  } catch {
    // No popup
  }
}

async function extractPermalink(el: Locator): Promise<string | null> {
  try {
    const permalinks = el.locator(
      'a[href*="/posts/"], a[href*="/photos/"], a[href*="story_fbid"], a[href*="/videos/"], a[href*="/permalink/"]'
    );
    if ((await permalinks.count()) === 0) return null;
    const href = await permalinks.first().getAttribute("href");
    if (!href) return null;
    const fullUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
    try {
      const parsed = new URL(fullUrl);
      if (parsed.hostname !== "www.facebook.com" && parsed.hostname !== "facebook.com") {
        return null;
      }
    } catch {
      return null;
    }
    return cleanFacebookUrl(fullUrl);
  } catch {
    return null;
  }
}

async function scrapePostPage(
  context: BrowserContext,
  link: string,
  pageName: string
): Promise<FacebookPost | null> {
  const postPage = await context.newPage();
  try {
    await postPage.goto(link, { waitUntil: "networkidle", timeout: TIMEOUTS.BROWSER });
    await dismissPopups(postPage);
    await postPage.waitForTimeout(randomDelay(DELAYS.POPUP.min, DELAYS.POPUP.max));

    dumpDebug("post", await postPage.content());

    const article = postPage.locator('div[role="article"]').first();
    if ((await article.count()) === 0) return null;

    const rawText = (await article.innerText()).trim();
    if (rawText.length < LIMITS.MIN_POST_TEXT) return null;

    const text = cleanPostText(rawText, pageName);
    if (text.length < LIMITS.MIN_CLEANED_TEXT) return null;

    const images: string[] = [];
    const imgs = article.locator("img[src*='fbcdn']");
    const imgCount = await imgs.count();
    for (let j = 0; j < imgCount && images.length < LIMITS.MAX_IMAGES; j++) {
      const img = imgs.nth(j);
      const src = await img.getAttribute("src");
      if (!src) continue;
      const box = await img.boundingBox();
      if (box && box.width > 150 && box.height > 150) {
        images.push(src);
      }
    }

    return { id: contentFingerprint(text), text, link, images, pageName };
  } catch (err) {
    console.warn(`  Failed to scrape post ${link}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    await postPage.close();
  }
}

export async function scrapePage(pageUrl: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const context = await browser.newContext({
      userAgent,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: TIMEOUTS.BROWSER });

    await dismissPopups(page);

    const title = await page.title();
    if (title.includes("Log in") || title.includes("Log Into")) {
      console.warn(`Redirected to login page: "${title}"`);
      dumpDebug("login-redirect", await page.content());
      return { posts: [], blocked: true, pageName: "", elementCount: 0 };
    }

    dumpDebug("page", await page.content());

    await page.evaluate(() => window.scrollBy(0, 800 + Math.random() * 400));
    await page.waitForTimeout(randomDelay(DELAYS.SCROLL.min, DELAYS.SCROLL.max));

    const pageNameEl = page.locator("h1").first();
    const pageName = (await pageNameEl.count()) > 0
      ? (await pageNameEl.innerText()).trim()
      : "";

    const articles = page.locator('div[role="article"]');
    const count = await articles.count();

    if (count === 0) {
      console.warn("No post elements found.");
      return { posts: [], blocked: false, pageName, elementCount: 0 };
    }

    // Collect permalinks from feed
    const permalinks: string[] = [];
    const maxPosts = Math.min(count, LIMITS.MAX_POSTS);

    for (let i = 0; i < maxPosts; i++) {
      const el = articles.nth(i);
      await el.scrollIntoViewIfNeeded();
      const link = await extractPermalink(el);
      if (link) permalinks.push(link);
      await page.waitForTimeout(randomDelay(DELAYS.BETWEEN_ARTICLES.min, DELAYS.BETWEEN_ARTICLES.max));
    }

    // Visit each post page to get full text
    const posts: FacebookPost[] = [];
    for (const link of permalinks) {
      const post = await scrapePostPage(context, link, pageName);
      if (post) posts.push(post);
      await page.waitForTimeout(randomDelay(DELAYS.BETWEEN_ARTICLES.min, DELAYS.BETWEEN_ARTICLES.max));
    }

    return { posts, blocked: false, pageName, elementCount: count };
  } finally {
    await browser.close();
  }
}
