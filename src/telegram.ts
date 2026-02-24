import { config } from "./config.js";
import { LIMITS } from "./constants.js";

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
}

function redactToken(text: string): string {
  return text.replaceAll(config.telegramBotToken, "[REDACTED]");
}

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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMessage(text: string, limit: number, opts?: { link?: string; pageName?: string }): string {
  const header = opts?.pageName ? `\ud83d\udce2 <b>${escapeHtml(opts.pageName)}</b>\n\n` : "";
  const footer = opts?.link ? `\n\n\ud83d\udd17 <a href="${escapeHtml(opts.link)}">${t("viewOnFacebook")}</a>` : "";
  const ellipsis = "\n(...)";

  const escaped = escapeHtml(text);
  const maxBody = limit - header.length - footer.length;

  if (escaped.length <= maxBody) {
    return header + escaped + footer;
  }

  return header + escaped.slice(0, maxBody - ellipsis.length) + ellipsis + footer;
}

export async function sendMessage(text: string, link?: string, pageName?: string) {
  const message = formatMessage(text, LIMITS.TELEGRAM_MESSAGE, { link, pageName });

  const res = await fetch(apiUrl("sendMessage"), {
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
    throw new Error(`Telegram API error ${res.status}: ${redactToken(body)}`);
  }
}

export async function sendPhoto(photoUrl: string, caption?: string, link?: string, pageName?: string) {
  const formattedCaption = caption
    ? formatMessage(caption, LIMITS.TELEGRAM_CAPTION, { link, pageName })
    : undefined;

  const res = await fetch(apiUrl("sendPhoto"), {
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
    throw new Error(`Telegram API error ${res.status}: ${redactToken(body)}`);
  }
}

export async function sendMediaGroup(
  photoUrls: string[],
  caption?: string,
  link?: string,
  pageName?: string
) {
  const formattedCaption = caption
    ? formatMessage(caption, LIMITS.TELEGRAM_CAPTION, { link, pageName })
    : undefined;

  const media = photoUrls.map((url, i) => ({
    type: "photo" as const,
    media: url,
    ...(i === 0 && formattedCaption ? { caption: formattedCaption, parse_mode: "HTML" as const } : {}),
  }));

  const res = await fetch(apiUrl("sendMediaGroup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      media,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${redactToken(body)}`);
  }
}
