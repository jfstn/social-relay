# \ud83d\udd01 Social Relay

Get Telegram notifications whenever a public Facebook page posts something new.

Point it at one or more Facebook pages, give it a Telegram bot token, and it will check periodically and forward new posts — text, images, and a link back to the original. No Facebook API key or login needed.

```
Facebook Page  ──\u279c  Headless Browser  ──\u279c  Telegram Chat
  (public)          (scrape + detect new)     (text + images + link)
```

## \u2699\ufe0f How it works

1. Scrapes each configured Facebook page with a headless browser (Playwright + stealth plugin)
2. Extracts post text, images, and permalink
3. Skips posts it has already sent
4. Forwards new posts to your Telegram chat

## \u26a0\ufe0f Important: use a residential IP

Facebook aggressively blocks datacenter IPs. If you run this on a typical VPS or cloud server, requests will be redirected to a login page almost immediately.

**You need a residential IP.** Options:

- \ud83c\udfe0 Run on a home server / Raspberry Pi / NAS behind a regular ISP connection
- \ud83c\udf10 Use a residential proxy (configure at the OS or browser level)
- \ud83d\udd12 Some VPN providers offer residential IPs

The bot detects blocks and sends a warning to Telegram when it gets redirected to login.

## \ud83d\ude80 Setup

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

See [Configuration reference](#-configuration-reference) for all options.

#### Getting the Telegram credentials

1. Message [@BotFather](https://t.me/BotFather) on Telegram, create a bot, copy the token
2. Add the bot to your target chat/group
3. Send a message in the chat, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the `chat_id`

## \u25b6\ufe0f Run

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start

# Debug mode (saves HTML snapshots to data/debug/)
DEBUG=1 pnpm dev
```

There's also a Dockerfile if you prefer containers.

## \ud83d\udccb Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | \u2705 | — | Telegram Bot API token |
| `TELEGRAM_CHAT_ID` | \u2705 | — | Target Telegram chat/group ID |
| `FACEBOOK_PAGES` | \u2705 | — | Comma-separated Facebook page URLs |
| `CHECK_INTERVAL_MINUTES` | | `30` | Base check interval in minutes (jittered \u00b130%) |
| `TIMEZONE` | | `UTC` | Timezone for night sleep window |
| `NIGHT_SLEEP_START` | | `0` | Hour to start sleeping (0-23) |
| `NIGHT_SLEEP_END` | | `8` | Hour to wake up (0-23). Set equal to start to disable |
| `BOT_LANGUAGE` | | `en` | Telegram message language (`en`, `pt`) |
| `DEBUG` | | `0` | Set to `1` to save HTML snapshots to `data/debug/` |

## \ud83e\uddd9 Anti-detection

- **Stealth plugin** — patches Playwright to avoid bot fingerprinting
- **Realistic user agent** — mimics a standard Chrome browser
- **Jittered intervals** — check timing varies \u00b130% to avoid predictable patterns
- **Randomized delays** — pauses between page actions vary randomly
- **Night sleep** — bot pauses during configurable hours to mimic human activity patterns
- **Cookie/popup dismissal** — handles Facebook consent banners and login popups

## \ud83d\udcc1 Project structure

```
src/
  config.ts      — env var parsing and validation
  constants.ts   — timeouts, limits, and delay ranges
  index.ts       — main loop, scheduling, orchestration
  scraper.ts     — headless browser scraping logic
  telegram.ts    — Telegram Bot API client
  store.ts       — sent post deduplication (JSON file)
```

## \ud83d\udcc4 License

[MIT](LICENSE)
