import { chromium, type BrowserContext, type Page } from "playwright";
import { createHash } from "crypto";

export interface FacebookPost {
  id: string;
  text: string;
  link: string | null;
  images: string[];
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

async function dismissDialogs(page: Page) {
  // Dismiss cookie consent
  try {
    const cookieBtn = page.locator(
      'button:has-text("Allow all cookies"), button:has-text("Decline optional cookies"), ' +
      'button:has-text("Permitir todos os cookies"), button:has-text("Recusar cookies opcionais"), ' +
      'button:has-text("Aceitar"), [data-cookiebanner="accept_button"]'
    );
    await cookieBtn.first().click({ timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch {
    // No cookie banner
  }

  // Dismiss login popup
  try {
    const closeBtn = page.locator(
      'div[role="dialog"] button[aria-label="Close"], div[role="dialog"] button[aria-label="Fechar"], ' +
      'dialog button:first-child'
    );
    await closeBtn.first().click({ timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch {
    // No popup
  }
}

async function getFullPostText(context: BrowserContext, postUrl: string): Promise<{ text: string; images: string[] } | null> {
  const page = await context.newPage();
  try {
    await page.goto(postUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await dismissDialogs(page);
    await page.waitForTimeout(1000);

    // On the individual post page, the full text is visible in the article
    const article = page.locator('div[role="article"]').first();
    if ((await article.count()) === 0) return null;

    const text = (await article.innerText()).trim();

    const images: string[] = [];
    const imgs = article.locator("img[src*='fbcdn']");
    const imgCount = await imgs.count();
    for (let j = 0; j < Math.min(imgCount, 4); j++) {
      const src = await imgs.nth(j).getAttribute("src");
      if (src) images.push(src);
    }

    return { text, images };
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

export async function scrapePage(
  pageUrl: string
): Promise<FacebookPost[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "pt-PT",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    console.log(`Navigating to ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60_000 });
    await dismissDialogs(page);

    // Scroll down to trigger lazy-loading
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(3000);

    const articles = page.locator('div[role="article"]');
    const count = await articles.count();

    if (count === 0) {
      console.warn("No posts found.");
      console.warn("Page title:", await page.title());
      return [];
    }

    console.log(`Found ${count} post elements`);
    const posts: FacebookPost[] = [];
    const maxPosts = Math.min(count, 10);

    for (let i = 0; i < maxPosts; i++) {
      try {
        const el = articles.nth(i);
        await el.scrollIntoViewIfNeeded();

        // Get preview text and permalink from the feed
        const previewText = (await el.innerText()).trim();
        if (previewText.length < 30) continue;

        let link: string | null = null;
        const permalinks = el.locator(
          'a[href*="/posts/"], a[href*="/photos/"], a[href*="story_fbid"], a[href*="/videos/"], a[href*="/permalink/"]'
        );
        if ((await permalinks.count()) > 0) {
          const href = await permalinks.first().getAttribute("href");
          if (href) {
            link = href.startsWith("http")
              ? href
              : `https://www.facebook.com${href}`;
          }
        }

        // If post is truncated and has a permalink, fetch full text from the post page
        let text = previewText;
        let images: string[] = [];
        const isTruncated = previewText.includes("See more") || previewText.includes("Ver mais");

        if (isTruncated && link) {
          console.log(`Post ${i} is truncated, fetching full text from ${link}`);
          const full = await getFullPostText(context, link);
          if (full) {
            text = full.text;
            images = full.images;
          }
        }

        // If we didn't get images from the full page, get them from the feed
        if (images.length === 0) {
          const imgs = el.locator("img[src*='fbcdn']");
          const imgCount = await imgs.count();
          for (let j = 0; j < Math.min(imgCount, 4); j++) {
            const src = await imgs.nth(j).getAttribute("src");
            if (src) images.push(src);
          }
        }

        const postId = hash(text.slice(0, 200));
        posts.push({ id: postId, text, link, images });
      } catch {
        continue;
      }
    }

    return posts;
  } finally {
    await browser.close();
  }
}
