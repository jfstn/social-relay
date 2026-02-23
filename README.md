# :repeat: Social Relay

Get Telegram notifications when a public Facebook page posts something new. No Facebook account or API key needed.

You give it Facebook page URLs, a Telegram bot token, and it checks every now and then for new posts. When it finds one, it sends the text, images and a link to your Telegram chat.

```
Facebook Page  ──>  Headless Browser  ──>  Telegram Chat
  (public)         (scrape + detect new)    (text + images + link)
```

## :thinking: Why this exists

Some local pages — parishes, small councils, sport clubs, community groups — only post updates on Facebook. If you don't use Facebook (or just don't want to keep checking), this bot watches those pages for you and sends updates straight to Telegram.

It was built to solve a very specific problem: not missing posts from the local parish page without having to open Facebook every day.

## :gear: How it works

1. Opens each Facebook page with a headless browser (like a normal visitor would)
2. Grabs the post text, images and permalink
3. Checks if it already sent that post before
4. If it's new, sends it to your Telegram chat

## :warning: Important: you need a residential IP

Facebook blocks datacenter IPs pretty aggressively. If you run this on a regular VPS or cloud server, it will get redirected to a login page almost immediately.

**You need a residential IP.** Some options:

- :house: Home server, Raspberry Pi, NAS — anything behind a normal ISP connection
- :globe_with_meridians: Residential proxy service
- :lock: Some VPN providers offer residential IPs

The bot detects when it gets blocked and sends a warning to Telegram.

## :rocket: Setup

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)

### Install

```bash
pnpm install
npx playwright install chromium
```

### Configure

```bash
cp .env.example .env
```

Then fill in your values:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
FACEBOOK_PAGES=https://www.facebook.com/page1,https://www.facebook.com/page2
```

#### How to get the Telegram credentials

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram, create a bot, copy the token
2. Add the bot to your chat or group
3. Send a message there, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the `chat_id`

## :arrow_forward: Run

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start

# Debug mode (saves HTML snapshots to data/debug/)
DEBUG=1 pnpm dev
```

### Docker

```bash
docker build -t social-relay .
docker run -d --env-file .env -v ./data:/app/data social-relay
```

## :clipboard: Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | :white_check_mark: | — | Telegram Bot API token |
| `TELEGRAM_CHAT_ID` | :white_check_mark: | — | Target chat/group ID |
| `FACEBOOK_PAGES` | :white_check_mark: | — | Comma-separated page URLs |
| `CHECK_INTERVAL_MINUTES` | | `30` | Check interval in minutes (±30% jitter) |
| `TIMEZONE` | | `UTC` | Timezone for the sleep window |
| `NIGHT_SLEEP_START` | | `0` | Hour to start sleeping (0-23) |
| `NIGHT_SLEEP_END` | | `8` | Hour to wake up. Set equal to start to disable |
| `BOT_LANGUAGE` | | `en` | Message language (`en`, `pt`) |
| `DEBUG` | | `0` | Save HTML snapshots to `data/debug/` |

## :mage: Anti-detection

Facebook doesn't like bots, so there's a few things in place:

- **Stealth plugin** — patches the browser to avoid fingerprinting
- **Realistic user agent** — looks like a normal Chrome browser
- **Jittered intervals** — check timing varies ±30% so it's not predictable
- **Random delays** — pauses between actions vary randomly
- **Night sleep** — pauses during configurable hours like a human would
- **Popup handling** — dismisses cookie banners and login popups

## :file_folder: Project structure

```
src/
  config.ts      — env var parsing and validation
  constants.ts   — timeouts, limits, delay ranges
  index.ts       — main loop and scheduling
  scraper.ts     — headless browser scraping
  telegram.ts    — Telegram Bot API client
  store.ts       — sent post deduplication
```

## :page_facing_up: License

[MIT](LICENSE)
