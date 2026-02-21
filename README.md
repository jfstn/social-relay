# Social Relay

Bot that watches public Facebook pages and sends new posts to Telegram. Text, images, links — everything goes to your chat automatically.

No Facebook API needed, no login needed. It just opens the page like a normal person would and reads what is there.

## Why this exists

Some organizations (parishes, local councils, small clubs...) only post on Facebook. If you dont want to check their page every day, this bot does it for you and sends everything to Telegram.

## How it works

1. Opens each Facebook page with a headless browser (Playwright)
2. Reads the posts, cleans the text, grabs images
3. Checks if the post was already sent before
4. If its new — sends to Telegram with the page name and a link back to Facebook
5. Waits, then checks again

## Important — use residential IP

Facebook blocks datacenter IPs very fast. If you run this on a normal VPS or cloud server, it will get redirected to the login page almost immediately.

**You need a residential IP.** Some options:

- Home server, Raspberry Pi, NAS — anything behind a normal ISP connection
- Residential proxy service
- VPN with residential IP option

The bot detects when it gets blocked and sends a warning message to Telegram.

## Setup

### Requirements

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
npx playwright install chromium
```

### Configure

```bash
cp .env.example .env
```

Then edit `.env` and fill in your values. You need at minimum:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
FACEBOOK_PAGES=https://www.facebook.com/somepage,https://www.facebook.com/anotherpage
```

#### How to get Telegram credentials

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram, create a new bot, copy the token
2. Add your bot to the chat or group where you want the posts
3. Send any message in that chat, then open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in browser — you will see the `chat_id` there

### Run

```bash
# development
pnpm dev

# production
pnpm build && pnpm start

# debug mode — saves HTML snapshots to data/debug/
DEBUG=1 pnpm dev
```

### Docker

```bash
docker build -t social-relay .
docker run --env-file .env -v ./data:/app/data social-relay
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | — | Telegram Bot API token from BotFather |
| `TELEGRAM_CHAT_ID` | yes | — | Chat or group ID where posts are sent |
| `FACEBOOK_PAGES` | yes | — | Comma-separated list of Facebook page URLs |
| `CHECK_INTERVAL_MINUTES` | no | `30` | How often to check, in minutes (±30% random jitter) |
| `TIMEZONE` | no | `Europe/Lisbon` | Timezone for the night sleep window |
| `NIGHT_SLEEP_START` | no | `0` | Hour to stop checking (0–23) |
| `NIGHT_SLEEP_END` | no | `8` | Hour to start checking again (0–23). Same as start = no sleep |
| `BOT_LANGUAGE` | no | `en` | Language for Telegram messages (`en` or `pt`) |
| `DEBUG` | no | `0` | Set `1` to save HTML page snapshots for debugging |

## How it avoids detection

- Stealth browser plugin (hides that its a bot)
- Normal Chrome user agent
- Random delays between actions
- Check interval has ±30% jitter so its not always the same time
- Night sleep mode — bot pauses during night hours like a real person
- Handles cookie popups and login dialogs automatically

## Project structure

```
src/
  config.ts      env var parsing and validation
  constants.ts   timeouts, limits, delay ranges
  index.ts       main loop and scheduling
  scraper.ts     headless browser scraping
  telegram.ts    Telegram Bot API client
  store.ts       post deduplication (JSON file store)
```

## License

MIT
