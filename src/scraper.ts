import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";

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
}

const DEBUG = process.env.DEBUG === "1";

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function cleanPostText(raw: string, pageName: string): string {
  let text = raw;

  // Remove page name and timestamp header (e.g. "Freguesia de Caranguejeira\n1 h\n")
  if (pageName) {
    const headerPattern = new RegExp(
      `^${pageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n.*?\\n+\\.?\\n*`,
      "i"
    );
    text = text.replace(headerPattern, "");
  }

  // Remove relative timestamp lines (e.g. "5 h", "2 d", "13 min") and trailing separators
  text = text.replace(
    /^\d+\s*(h|d|m|s|min|hr|hrs|hora|horas|dia|dias|sem|semana|semanas)\b[^\n]*\n?[\s·.]*/gim,
    ""
  );
  text = text.replace(
    /^(Just now|Agora mesmo|Agora|Yesterday|Ontem|Há\s+\d+\s+[^\n]+)\n?[\s·.]*/gim,
    ""
  );

  // Remove reactions/engagement footer
  text = text.replace(/\n*(Todas as reações|All reactions):[\s\S]*$/i, "");

  // Remove "Like/Comment/Share" buttons text
  text = text.replace(/\n*(Gosto|Like)\n+(Comentar|Comment)(\n+(Partilhar|Share))?[\s\S]*$/i, "");

  // Remove "See more" / "Ver mais" leftovers
  text = text.replace(/\s*(See more|Ver mais)\s*/gi, "");

  // Remove stray dots/middle dots that Facebook uses as separators
  text = text.replace(/^[·.]\s*$/gm, "");

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

function cleanFacebookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    [
      "__cft__", "__cft__[0]", "__tn__", "ref",
      "__xts__", "__xts__[0]", "refid", "paipv", "_rdr",
    ].forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url;
  }
}

function dumpDebug(label: string, content: string) {
  if (!DEBUG) return;
  mkdirSync("./data/debug", { recursive: true });
  const file = `./data/debug/${label}-${Date.now()}.html`;
  writeFileSync(file, content);
  console.log(`[debug] Saved ${file}`);
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
      locale: "pt-PT",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    console.log(`Navigating to ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 60_000 });

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
        'div[role="dialog"] button[aria-label="Close"], div[role="dialog"] button[aria-label="Fechar"]'
      );
      await closeBtn.first().click({ timeout: 3000 });
      await page.waitForTimeout(1000);
    } catch {
      // No popup
    }

    // Check if we got blocked
    const title = await page.title();
    if (title.includes("Iniciar sessão") || title.includes("Log in") || title.includes("Log Into")) {
      console.warn(`Redirected to login page: "${title}"`);
      dumpDebug("login-redirect", await page.content());
      return { posts: [], blocked: true };
    }

    dumpDebug("page", await page.content());

    // Scroll down to trigger lazy-loading
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(3000);

    // Get the page name
    const pageNameEl = page.locator("h1").first();
    const pageName =
      (await pageNameEl.count()) > 0
        ? (await pageNameEl.innerText()).trim()
        : "";

    console.log(`Page name: ${pageName}`);

    const articles = page.locator('div[role="article"]');
    const count = await articles.count();

    if (count === 0) {
      console.warn("No post elements found.");
      console.warn("Page title:", title);
      return { posts: [], blocked: false };
    }

    console.log(`Found ${count} post elements`);
    const posts: FacebookPost[] = [];
    const maxPosts = Math.min(count, 10);

    for (let i = 0; i < maxPosts; i++) {
      try {
        const el = articles.nth(i);
        await el.scrollIntoViewIfNeeded();

        const previewText = (await el.innerText()).trim();
        if (previewText.length < 30) continue;

        // Find permalink
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

        if (link) link = cleanFacebookUrl(link);

        // Clean the text
        const text = cleanPostText(previewText, pageName);
        if (text.length < 10) continue;

        // Extract images
        const images: string[] = [];
        const imgs = el.locator("img[src*='fbcdn']");
        const imgCount = await imgs.count();
        for (let j = 0; j < Math.min(imgCount, 4); j++) {
          const src = await imgs.nth(j).getAttribute("src");
          if (src) images.push(src);
        }

        // Use permalink as stable ID, fall back to text hash
        const postId = link ? hash(link) : hash(text.slice(0, 200));
        posts.push({ id: postId, text, link, images, pageName });
      } catch {
        continue;
      }
    }

    console.log(`Found ${posts.length} posts`);
    return { posts, blocked: false };
  } finally {
    await browser.close();
  }
}
