import { config } from "./config.js";
import { LIMITS } from "./constants.js";

const API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;

const strings: Record<string, Record<string, string>> = {
  pt: {
    viewOnFacebook: "Ver no Facebook",
  },
  en: {
    viewOnFacebook: "View on Facebook",
  },
};

function t(key: string): string {
  return strings[config.language]?.[key] ?? strings.en[key] ?? key;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessage(text: string, limit: number, opts?: { link?: string; pageName?: string }): string {
  const header = opts?.pageName ? `\ud83d\udce2 <b>${escapeHtml(opts.pageName)}</b>\n\n` : "";
  const footer = opts?.link ? `\n\n\ud83d\udd17 <a href="${opts.link}">${t("viewOnFacebook")}</a>` : "";
  const ellipsis = "\n(...)";

  const maxBody = limit - header.length - footer.length;

  if (escapeHtml(text).length <= maxBody) {
    return header + escapeHtml(text) + footer;
  }

  // Truncate the plain text first, then escape — so .slice() never cuts
  // through HTML entities like &amp;. We walk the plain text tracking how
  // many HTML characters each raw character would produce, and stop once
  // we'd exceed the budget.
  const budget = maxBody - ellipsis.length;
  let htmlLen = 0;
  let cutIndex = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const escapedLen = ch === "&" ? 5 : ch === "<" ? 4 : ch === ">" ? 4 : 1;
    if (htmlLen + escapedLen > budget) break;
    htmlLen += escapedLen;
    cutIndex = i + 1;
  }

  return header + escapeHtml(text.slice(0, cutIndex)) + ellipsis + footer;
}

export async function sendMessage(text: string, link?: string, pageName?: string) {
  const message = formatMessage(text, LIMITS.TELEGRAM_MESSAGE, { link, pageName });

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendPhoto(photoUrl: string, caption?: string, link?: string, pageName?: string) {
  const formattedCaption = caption
    ? formatMessage(caption, LIMITS.TELEGRAM_CAPTION, { link, pageName })
    : undefined;

  const res = await fetch(`${API_BASE}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      photo: photoUrl,
      caption: formattedCaption,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
