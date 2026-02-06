# Social Relay

Facebook-to-Telegram relay bot. Watches one or more public Facebook pages and forwards new posts (text + images) to a Telegram chat.

## How it works

1. Periodically scrapes each configured Facebook page using a headless browser (Playwright + stealth plugin)
2. Extracts post text, images, and permalink from the page
3. Deduplicates against previously sent posts
4. Forwards new posts to Telegram with the page name, cleaned text, and a link back to Facebook

No Facebook API or login required — it reads public pages the same way any visitor would.

## Important: use a residential IP

Facebook aggressively blocks datacenter IPs. If you run this on a typical VPS or cloud server, requests will be redirected to a login page almost immediately.

**You need a residential IP.** Options:

- Run on a home server / Raspberry Pi / NAS behind a regular ISP connection
- Use a residential proxy (configure at the OS or browser level)
- Some VPN providers offer residential IPs

The bot detects blocks and sends a warning to Telegram when it gets redirected to login.

## Setup

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)

### Install

```bash
pnpm install
npx playwright install chromium
```

### Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
FACEBOOK_PAGES=https://www.facebook.com/page1,https://www.facebook.com/page2
```

See [Configuration reference](#configuration-reference) for all options.

#### Getting the Telegram credentials

1. Message [@BotFather](https://t.me/BotFather) on Telegram, create a bot, copy the token
2. Add the bot to your target chat/group
3. Send a message in the chat, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the `chat_id`

## Run

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start

# Debug mode (saves HTML snapshots to data/debug/)
DEBUG=1 pnpm dev
```

## Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Telegram Bot API token |
| `TELEGRAM_CHAT_ID` | Yes | — | Target Telegram chat/group ID |
| `FACEBOOK_PAGES` | Yes | — | Comma-separated Facebook page URLs |
| `CHECK_INTERVAL_MINUTES` | No | `30` | Base check interval in minutes (jittered ±30%) |
| `TIMEZONE` | No | `Europe/Lisbon` | Timezone for night sleep window |
| `NIGHT_SLEEP_START` | No | `0` | Hour to start sleeping (0-23) |
| `NIGHT_SLEEP_END` | No | `8` | Hour to wake up (0-23). Set equal to start to disable |
| `BOT_LANGUAGE` | No | `en` | Telegram message language. Supported: `en`, `pt` |
| `DEBUG` | No | `0` | Set to `1` to save HTML snapshots to `data/debug/` |

## Anti-detection

- **Stealth plugin** — patches Playwright to avoid bot fingerprinting
- **Realistic user agent** — mimics a standard Chrome browser
- **Jittered intervals** — check timing varies ±30% to avoid predictable patterns
- **Randomized page actions** — delays between clicks, scrolls, and interactions vary randomly
- **Night sleep** — bot pauses during configurable hours to mimic human activity patterns
- **Cookie/popup dismissal** — handles Facebook consent banners and login popups

## Project structure

```
src/
  config.ts      — env var parsing and validation
  constants.ts   — timeouts, limits, and delay ranges
  index.ts       — main loop, scheduling, orchestration
  scraper.ts     — headless browser scraping logic
  telegram.ts    — Telegram Bot API client
  store.ts       — sent post deduplication (JSON file)
```
