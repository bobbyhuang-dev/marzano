import { parseData, serializeData, type DataContents } from "@/lib/data-file";

export interface LocalDirectory extends FileSystemDirectoryHandle {
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export interface CachedData {
  contents: DataContents;
  directory: LocalDirectory | null;
  baseline: string | null;
  directoryId?: string | null;
  upgrade?: { required: boolean; completed: boolean; legacyFingerprint: string };
}

export class UnreadableCacheError extends Error {}

export const RECOVERY_STORAGE_KEY = "marzano.browser-recovery.v1";
interface StoredData {
  text: string;
  baseline: string | null;
  directory?: LocalDirectory | null;
  directoryId?: string | null;
  upgrade?: CachedData["upgrade"];
  revision?: number;
}
let lastRevision = 0;

function decode(stored: StoredData): CachedData {
  lastRevision = Math.max(lastRevision, stored.revision ?? 0);
  return {
    contents: parseData(stored.text), directory: stored.directory ?? null,
    baseline: stored.baseline, directoryId: stored.directoryId, upgrade: stored.upgrade,
  };
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("marzano.local-data", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Marzano tabs to open storage."));
  });
}

async function readIndexedCache(): Promise<StoredData | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("data", "readonly");
      const request = transaction.objectStore("data").get("current");
      transaction.oncomplete = () => {
        try {
          const stored = request.result;
          resolve(stored ?? null);
        } catch (error) { reject(error); }
      };
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function writeIndexedCache(stored: StoredData): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("data", "readwrite");
      transaction.objectStore("data").put(stored, "current");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

/** An atomic browser fallback keeps pre-folder editing durable when IndexedDB is blocked. */
export async function readCache(): Promise<CachedData | null> {
  let fallback: StoredData | null = null;
  let indexed: StoredData | null;
  let failed = false;
  let malformed = false;
  try {
    const raw = window.localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (raw) {
      try { fallback = JSON.parse(raw); decode(fallback!); }
      catch { malformed = true; throw new Error("Invalid browser snapshot"); }
    }
  } catch { fallback = null; failed = true; }
  try {
    indexed = await readIndexedCache();
    if (indexed) {
      try { decode(indexed); }
      catch { malformed = true; throw new Error("Invalid browser snapshot"); }
    }
  }
  catch { indexed = null; failed = true; }
  if (fallback && (!indexed || (fallback.revision ?? 0) > (indexed.revision ?? 0))) {
    // A stale IDB handle must never point newer pending data at a different folder.
    const directory = indexed && indexed.directoryId === fallback.directoryId ? indexed.directory : null;
    return decode({ ...fallback, directory });
  }
  if (indexed) return decode(indexed);
  if (malformed) throw new UnreadableCacheError("Browser recovery data is unreadable. Its original contents have been left untouched. Reconnect your folder or open a saved data file to recover it.");
  if (failed) throw new Error("Browser recovery storage could not be read.");
  return null;
}

export async function writeCache(data: CachedData): Promise<void> {
  const stored: StoredData = {
    text: serializeData(data.contents), baseline: data.baseline,
    directory: data.directory, directoryId: data.directoryId, upgrade: data.upgrade,
    revision: lastRevision = Math.max(Date.now(), lastRevision + 1),
  };
  let fallbackSaved = false;
  try {
    window.localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ ...stored, directory: undefined }));
    fallbackSaved = true;
  } catch { /* IDB can still save when localStorage is full or unavailable. */ }
  try { await writeIndexedCache(stored); }
  catch (error) { if (!fallbackSaved) throw error; }
}
