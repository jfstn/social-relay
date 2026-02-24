import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { LIMITS } from "./constants.js";

const STORE_FILE = "./data/sent-posts.json";

interface StoreFile {
  sentIds: string[];
}

// In-memory cache — loaded once at module init, kept in sync on every write.
const sentIds: Set<string> = loadFromDisk();

/**
 * Read the JSON file from disk and return a Set of IDs.
 * If the file is missing, return an empty Set.
 * If the file is corrupted (invalid JSON / unexpected shape), log a warning
 * and start fresh so the app keeps running.
 */
function loadFromDisk(): Set<string> {
  if (!existsSync(STORE_FILE)) return new Set();

  try {
    const raw = readFileSync(STORE_FILE, "utf-8");
    const parsed: StoreFile = JSON.parse(raw);

    if (!Array.isArray(parsed.sentIds)) {
      console.warn(
        `[store] "${STORE_FILE}" has unexpected shape — starting fresh.`,
      );
      return new Set();
    }

    return new Set(parsed.sentIds);
  } catch (err) {
    console.warn(
      `[store] Failed to parse "${STORE_FILE}" — starting fresh.`,
      err,
    );
    return new Set();
  }
}

/**
 * Persist the current in-memory Set to disk.
 * When the set exceeds STORE_MAX_IDS, keep only the most recent entries.
 */
function saveToDisk() {
  let ids = Array.from(sentIds);

  if (ids.length > LIMITS.STORE_MAX_IDS) {
    // Keep the most recent entries (end of the array).
    ids = ids.slice(-LIMITS.STORE_MAX_IDS);

    // Rebuild the in-memory Set so it stays in sync with what we persisted.
    sentIds.clear();
    for (const id of ids) {
      sentIds.add(id);
    }
  }

  try {
    const store: StoreFile = { sentIds: ids };
    mkdirSync("./data", { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("[store] Failed to persist sent IDs to disk:", err);
  }
}

/** O(1) check whether a post was already sent. */
export function wasSent(id: string): boolean {
  return sentIds.has(id);
}

/** Mark a post as sent — updates the in-memory Set and persists to disk. */
export function markSent(id: string) {
  sentIds.add(id);
  saveToDisk();
}
