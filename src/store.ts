import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { LIMITS } from "./constants.js";

const STORE_FILE = "./data/sent-posts.json";

interface Store {
  sentIds: string[];
  sentTextHashes?: string[];
}

function load(): Store {
  if (!existsSync(STORE_FILE)) return { sentIds: [], sentTextHashes: [] };
  const store = JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  if (!store.sentTextHashes) store.sentTextHashes = [];
  return store;
}

function save(store: Store) {
  mkdirSync("./data", { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function wasSent(id: string, textHash?: string): boolean {
  const store = load();
  if (store.sentIds.includes(id)) return true;
  if (textHash && store.sentTextHashes!.includes(textHash)) return true;
  return false;
}

export function markSent(id: string, textHash?: string) {
  const store = load();
  store.sentIds.push(id);
  if (store.sentIds.length > LIMITS.STORE_MAX_IDS) {
    store.sentIds = store.sentIds.slice(-LIMITS.STORE_MAX_IDS);
  }
  if (textHash) {
    store.sentTextHashes!.push(textHash);
    if (store.sentTextHashes!.length > LIMITS.STORE_MAX_IDS) {
      store.sentTextHashes = store.sentTextHashes!.slice(-LIMITS.STORE_MAX_IDS);
    }
  }
  save(store);
}
