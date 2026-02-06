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

function formatMessage(text: string, opts?: { link?: string; pageName?: string }): string {
  let msg = "";

  if (opts?.pageName) {
    msg += `\ud83d\udce2 <b>${escapeHtml(opts.pageName)}</b>\n\n`;
  }

  msg += escapeHtml(text);

  if (opts?.link) {
    msg += `\n\n\ud83d\udd17 <a href="${opts.link}">${t("viewOnFacebook")}</a>`;
  }

  return msg;
}

export async function sendMessage(text: string, link?: string, pageName?: string) {
  let message = formatMessage(text, { link, pageName });

  if (message.length > LIMITS.TELEGRAM_MESSAGE) {
    message = message.slice(0, LIMITS.TELEGRAM_MESSAGE - 6) + "\n(...)";
  }

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendPhoto(photoUrl: string, caption?: string, link?: string, pageName?: string) {
  let formattedCaption: string | undefined;
  if (caption) {
    formattedCaption = formatMessage(caption, { link, pageName });
    if (formattedCaption.length > LIMITS.TELEGRAM_CAPTION) {
      formattedCaption = formattedCaption.slice(0, LIMITS.TELEGRAM_CAPTION - 6) + "\n(...)";
    }
  }

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
