import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const DATA_DIR = process.env.DATA_DIR || "./data";
const STORE_FILE = `${DATA_DIR}/sent-posts.json`;

interface Store {
  sentIds: string[];
}

function load(): Store {
  if (!existsSync(STORE_FILE)) return { sentIds: [] };
  return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
}

function save(store: Store) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function wasSent(id: string): boolean {
  return load().sentIds.includes(id);
}

export function markSent(id: string) {
  const store = load();
  store.sentIds.push(id);
  // Keep only the last 500 to avoid unbounded growth
  if (store.sentIds.length > 500) {
    store.sentIds = store.sentIds.slice(-500);
  }
  save(store);
}
