import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { config } from "./config.js";
import { TIMEOUTS, LIMITS, DELAYS } from "./constants.js";

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

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

function dumpDebug(label: string, content: string) {
  if (!config.debug) return;
  mkdirSync("./data/debug", { recursive: true });
  const file = `./data/debug/${label}-${Date.now()}.html`;
  writeFileSync(file, content);
  console.log(`[debug] Saved ${file}`);
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

function cleanFacebookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    ["__cft__", "__cft__[0]", "__tn__", "ref", "__xts__", "__xts__[0]", "refid", "paipv", "_rdr"]
      .forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}

async function dismissPopups(page: any) {
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

async function extractPost(el: any, pageName: string): Promise<FacebookPost | null> {
  try {
    const previewText = (await el.innerText()).trim();
    if (previewText.length < LIMITS.MIN_POST_TEXT) return null;

    let link: string | null = null;
    const permalinks = el.locator(
      'a[href*="/posts/"], a[href*="/photos/"], a[href*="story_fbid"], a[href*="/videos/"], a[href*="/permalink/"]'
    );
    if ((await permalinks.count()) > 0) {
      const href = await permalinks.first().getAttribute("href");
      if (href) {
        const fullUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;
        link = cleanFacebookUrl(fullUrl);
      }
    }

    const text = cleanPostText(previewText, pageName);
    if (text.length < LIMITS.MIN_CLEANED_TEXT) return null;

    const images: string[] = [];
    const imgs = el.locator("img[src*='fbcdn']");
    const imgCount = await imgs.count();
    for (let j = 0; j < Math.min(imgCount, LIMITS.MAX_IMAGES); j++) {
      const src = await imgs.nth(j).getAttribute("src");
      if (src) images.push(src);
    }

    const postId = link ? hash(link) : hash(text.slice(0, 200));
    return { id: postId, text, link, images, pageName };
  } catch {
    return null;
  }
}

export async function scrapePage(pageUrl: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
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

    const posts: FacebookPost[] = [];
    const maxPosts = Math.min(count, LIMITS.MAX_POSTS);

    for (let i = 0; i < maxPosts; i++) {
      const el = articles.nth(i);
      await page.waitForTimeout(randomDelay(DELAYS.BETWEEN_ARTICLES.min, DELAYS.BETWEEN_ARTICLES.max));
      await el.scrollIntoViewIfNeeded();

      const post = await extractPost(el, pageName);
      if (post) posts.push(post);
    }

    return { posts, blocked: false, pageName, elementCount: count };
  } finally {
    await browser.close();
  }
}
