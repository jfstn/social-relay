import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { LIMITS } from "./constants.js";

const STORE_FILE = "./data/sent-posts.json";

interface Store {
  sentIds: string[];
}

function load(): Store {
  if (!existsSync(STORE_FILE)) return { sentIds: [] };
  return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
}

function save(store: Store) {
  mkdirSync("./data", { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function wasSent(id: string): boolean {
  return load().sentIds.includes(id);
}

export function markSent(id: string) {
  const store = load();
  store.sentIds.push(id);
  if (store.sentIds.length > LIMITS.STORE_MAX_IDS) {
    store.sentIds = store.sentIds.slice(-LIMITS.STORE_MAX_IDS);
  }
  save(store);
}
