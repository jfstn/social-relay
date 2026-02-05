const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(text: string, link?: string) {
  let message = text;
  if (link) message += `\n\n${link}`;

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
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

export async function sendPhoto(photoUrl: string, caption?: string) {
  const res = await fetch(`${API_BASE}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      photo: photoUrl,
      caption: caption?.slice(0, 1024),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
