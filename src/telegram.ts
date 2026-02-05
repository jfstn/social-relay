const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
    msg += `\n\n\ud83d\udd17 <a href="${opts.link}">Ver no Facebook</a>`;
  }

  return msg;
}

export async function sendMessage(text: string, link?: string, pageName?: string) {
  let message = formatMessage(text, { link, pageName });

  // Telegram max message length is 4096
  if (message.length > 4096) {
    message = message.slice(0, 4090) + "\n(...)";
  }

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
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
    // Telegram caption limit is 1024
    if (formattedCaption.length > 1024) {
      formattedCaption = formattedCaption.slice(0, 1018) + "\n(...)";
    }
  }

  const res = await fetch(`${API_BASE}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
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
