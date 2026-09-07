import { applyImport } from "@/lib/backup";
import { readCache, writeCache, UnreadableCacheError, type CachedData, type LocalDirectory } from "@/lib/data-cache";
import { DATA_FILE_NAME, dataKey, parseData, readDataFile, serializeData, type DataContents } from "@/lib/data-file";
import { loadPomodoroHistory, loadPomodoroSettings } from "@/lib/pomodoro";
import { loadTags } from "@/lib/tags";
import { readLegacySnapshot, type LegacySnapshot } from "@/lib/storage-upgrade";
import { loadTasks } from "@/lib/tasks";

type Phase = "browser" | "saved" | "saving" | "access" | "error" | "conflict";
export interface DataStatus {
  phase: Phase;
  folder: string | null;
  message: string;
  cacheWarning: string;
  savedAt: string | null;
  busy: boolean;
  upgradeRequired: boolean;
  upgradeCompleted: boolean;
  olderTabChanged: boolean;
}
/** The status in as few words as a pill can hold; the dialog carries the detail. */
export function storageLabel(status: DataStatus): string {
  if (status.busy) return "Opening folder…";
  switch (status.phase) {
    case "saved": return "Saved to folder";
    case "saving": return "Saving…";
    case "access": return "Folder disconnected";
    case "error": return "Not saved";
    case "conflict": return "Needs review";
    default: return "In this browser only";
  }
}

export interface FolderPreview {
  directory: LocalDirectory;
  raw: string;
  contents: DataContents;
}
export interface DataEnvironment {
  readCache: () => Promise<CachedData | null>;
  readLegacy?: () => LegacySnapshot;
  writeCache: (data: CachedData) => Promise<void>;
  lock: <T>(action: () => Promise<T>) => Promise<T>;
}

export function supportsLocalFolders(): boolean {
  return window.isSecureContext && "showDirectoryPicker" in window;
}

export function downloadCopy(contents: DataContents) {
  const url = URL.createObjectURL(new Blob([serializeData(contents)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = DATA_FILE_NAME; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function pickDataFolder(): Promise<LocalDirectory> {
  const picker = window as unknown as { showDirectoryPicker: (options: object) => Promise<LocalDirectory> };
  return picker.showDirectoryPicker({ id: "marzano-data", mode: "readwrite", startIn: "documents" });
}

const browserEnvironment: DataEnvironment = {
  readCache,
  readLegacy: readLegacySnapshot,
  writeCache,
  lock: async (action) => await navigator.locks.request("marzano.file-write", action),
};

function errorMessage(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "Marzano lost access to the folder. Reconnect to keep saving.";
  }
  return cause instanceof Error ? cause.message : "Couldn’t save to the folder. Reconnect and try again.";
}

async function readFolder(directory: LocalDirectory): Promise<string | null> {
  let handle;
  try { handle = await directory.getFileHandle(DATA_FILE_NAME); }
  catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw error;
  }
  return readDataFile(await handle.getFile());
}

async function writeFile(directory: FileSystemDirectoryHandle, name: string, text: string, expected?: string | null): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable({ mode: "exclusive" } as FileSystemCreateWritableOptions);
  try {
    if (expected !== undefined && await (await handle.getFile()).text() !== (expected ?? "")) {
      throw new Error("The file changed just before saving. Reconnect to review it.");
    }
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
  if (await (await handle.getFile()).text() !== text) throw new Error("The save couldn’t be verified. Your changes are still waiting.");
}

/** One writer per browser, serialized writes, and an exact disk comparison before replacement. */
export class LocalDataStore {
  contents: DataContents;
  private directory: LocalDirectory | null = null;
  private baseline: string | null = null;
  private savedKey: string | null = null;
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private status: DataStatus = { phase: "browser", folder: null, message: "", cacheWarning: "", savedAt: null, busy: false, upgradeRequired: false, upgradeCompleted: false, olderTabChanged: false };
  private stopped = false;
  private lastRecovery = "";
  private directoryId: string | null = null;
  private legacyFingerprint = "";
  private pendingLegacy: LegacySnapshot | null = null;
  private preserveUnreadableCache = false;

  constructor(contents: DataContents, private env: DataEnvironment = browserEnvironment) {
    this.contents = contents;
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.status;
  private publish(patch: Partial<DataStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  get hasPendingChanges() { return this.savedKey !== dataKey(this.contents); }
  /**
   * Whether closing the tab could lose an edit. Browser-only data is written
   * to the cache synchronously on every change, so it is only a folder write
   * still in flight, or a cache that could not be written, that is at risk.
   */
  get hasUnsavedChanges() {
    return (this.directory !== null && this.hasPendingChanges) || this.status.cacheWarning !== "";
  }

  private async cache() {
    if (this.preserveUnreadableCache) return;
    try {
      await this.env.writeCache({
        contents: this.contents, directory: this.directory, baseline: this.baseline, directoryId: this.directoryId,
        upgrade: { required: this.status.upgradeRequired, completed: this.status.upgradeCompleted, legacyFingerprint: this.legacyFingerprint },
      });
      this.publish({ cacheWarning: "" });
    } catch {
      this.publish({ cacheWarning: "Browser storage is unavailable. Keep this tab open until your changes are saved to the folder." });
    }
  }

  async initialize(): Promise<void> {
    const legacy = this.env.readLegacy?.();
    this.contents = legacy?.contents ?? this.contents;
    this.legacyFingerprint = legacy?.fingerprint ?? "";
    this.publish({ upgradeRequired: legacy?.existingUser ?? false });
    try {
      const cached = await this.env.readCache();
      if (cached) {
        this.contents = cached.contents;
        this.directoryId = cached.directoryId ?? null;
        this.legacyFingerprint = cached.upgrade?.legacyFingerprint ?? this.legacyFingerprint;
        this.publish({
          folder: cached.directory?.name ?? null,
          upgradeRequired: cached.upgrade?.required ?? this.status.upgradeRequired,
          upgradeCompleted: cached.upgrade?.completed ?? false,
        });
        this.directory = cached.directory;
        this.baseline = cached.baseline;
        this.savedKey = cached.baseline === null ? null : dataKey(parseData(cached.baseline));
      }
    } catch (cause) {
      if (cause instanceof UnreadableCacheError) this.preserveUnreadableCache = true;
      this.publish({ cacheWarning: "Browser storage couldn’t be read. Choose your folder again to get your tasks back." });
    }
    if (legacy && legacy.fingerprint !== this.legacyFingerprint) {
      this.recordLegacyChange(legacy);
      return;
    }
    if (!this.directory) { await this.cache(); this.checkLegacyChanges(); return; }
    this.publish({ folder: this.directory.name });
    try {
      if (await this.directory.queryPermission({ mode: "readwrite" }) !== "granted") {
        this.stopped = true;
        this.publish({ phase: "access", message: "Saving is paused until you reconnect." });
        return;
      }
      const raw = await readFolder(this.directory);
      if (raw === null) throw new Error("marzano.json is missing from the folder. Restore it from marzano-recovery, or choose a new folder to save this copy.");
      if (raw !== this.baseline && this.hasPendingChanges && dataKey(parseData(raw)) !== dataKey(this.contents)) {
        this.stopped = true;
        this.publish({ phase: "conflict", message: "The folder and this browser both have changes. Reconnect to review them." });
        return;
      }
      if (!this.hasPendingChanges) this.contents = parseData(raw);
      this.baseline = raw;
      this.savedKey = dataKey(parseData(raw));
      this.publish({ phase: this.hasPendingChanges ? "saving" : "saved", message: "" });
      await this.cache();
      if (this.hasPendingChanges) await this.flush();
      this.completeUpgrade();
      await this.cache();
    } catch (cause) { this.fail(cause); }
  }

  update(contents: DataContents) {
    if (dataKey(contents) === dataKey(this.contents)) return;
    this.contents = contents;
    if (this.directory && (!this.stopped || this.status.phase === "saved")) this.publish({ phase: "saving", message: "" });
    void this.flush();
  }

  flush(): Promise<void> {
    this.queue = this.queue.then(async () => {
      await this.cache();
      this.checkLegacyChanges();
      if (!this.directory || this.stopped || !this.hasPendingChanges) return;
      try {
        await this.env.lock(async () => {
          const directory = this.directory!;
          const current = await readFolder(directory);
          if (current !== this.baseline) {
            this.stopped = true;
            this.publish({ phase: "conflict", message: "The file changed outside Marzano. Reconnect to review it before saving." });
            return;
          }
          const contents = this.contents;
          const text = serializeData(contents);
          // Keep the pre-edit file once per hour. Never replace it with a later
          // edit from that hour; the first copy is the useful recovery point.
          const hour = new Date().toISOString().slice(0, 13).replaceAll(":", "-");
          if (current !== null && this.lastRecovery !== hour) {
            const recovery = await directory.getDirectoryHandle("marzano-recovery", { create: true });
            const name = `marzano-${hour}.json`;
            try { await recovery.getFileHandle(name); }
            catch (cause) {
              if (!(cause instanceof DOMException) || cause.name !== "NotFoundError") throw cause;
              await writeFile(recovery, name, current);
            }
            this.lastRecovery = hour;
          }
          // Backup work may take time; check again immediately before the write.
          if (await readFolder(directory) !== current) throw new Error("The file changed while saving. Reconnect to review it.");
          this.checkLegacyChanges();
          if (this.stopped) return;
          await writeFile(directory, DATA_FILE_NAME, text, current);
          this.baseline = text;
          this.savedKey = dataKey(contents);
          await this.cache();
          if (!this.stopped) this.publish({ phase: this.hasPendingChanges ? "saving" : "saved", message: "", savedAt: new Date().toISOString() });
          this.completeUpgrade();
          await this.cache();
          await this.pruneRecovery(directory);
        });
      } catch (cause) { this.fail(cause); }
    });
    return this.queue;
  }

  private async pruneRecovery(directory: LocalDirectory) {
    try {
      const recovery = await directory.getDirectoryHandle("marzano-recovery") as LocalDirectory;
      const names: string[] = [];
      for await (const entry of recovery.values()) {
        if (entry.kind === "file" && /^marzano-\d{4}-\d{2}-\d{2}T\d{2}\.json$/.test(entry.name)) names.push(entry.name);
      }
      for (const name of names.sort().slice(0, -24)) await recovery.removeEntry(name);
    } catch { /* Retention failure must not misreport a verified primary save. */ }
  }

  private fail(cause: unknown) {
    this.stopped = true;
    this.publish({ phase: cause instanceof DOMException && cause.name === "NotAllowedError" ? "access" : "error", message: errorMessage(cause), busy: false });
  }

  /** Selecting an existing folder is always read-only until its preview is accepted. */
  async inspect(directory: LocalDirectory): Promise<FolderPreview | null> {
    if (this.status.olderTabChanged) return null;
    this.stopped = true;
    this.publish({ busy: true });
    await this.queue;
    try {
      const raw = await readFolder(directory);
      if (raw !== null) return { directory, raw, contents: parseData(raw) };
      // Only an explicitly selected new folder may create a missing live file.
      // Reconnecting the active folder must never recreate a missing file silently.
      if (this.directory && await directory.isSameEntry(this.directory)) {
        throw new Error("marzano.json is missing from the folder. Restore it from marzano-recovery, or choose a new folder to save this copy.");
      }
      this.directory = directory;
      this.directoryId = crypto.randomUUID();
      this.baseline = null;
      this.savedKey = null;
      this.lastRecovery = "";
      this.stopped = false;
      this.publish({ folder: directory.name, phase: "saving", message: "" });
      await this.flush();
      return null;
    } catch (cause) { this.fail(cause); return null; }
    finally { this.publish({ busy: false }); }
  }

  async reconnect(): Promise<FolderPreview | null> {
    if (!this.directory) return null;
    try {
      // Called directly by a click, before any other await consumes activation.
      if (await this.directory.requestPermission({ mode: "readwrite" }) !== "granted") {
        throw new DOMException("Folder access wasn’t granted.", "NotAllowedError");
      }
      return await this.inspect(this.directory);
    } catch (cause) { this.fail(cause); return null; }
  }

  async accept(preview: FolderPreview, mode: "replace" | "merge", onApply: (contents: DataContents) => void): Promise<DataContents | null> {
    this.publish({ busy: true });
    await this.queue;
    try {
      if (await readFolder(preview.directory) !== preview.raw) throw new Error("The file changed since you looked at it. Reconnect to read it again.");
      const next = applyImport(mode, this.contents, preview.contents);
      this.directory = preview.directory;
      this.directoryId = crypto.randomUUID();
      this.baseline = preview.raw;
      this.savedKey = dataKey(preview.contents);
      this.contents = next;
      onApply(next);
      this.lastRecovery = "";
      this.stopped = false;
      this.publish({ folder: this.directory.name, phase: this.hasPendingChanges ? "saving" : "saved", message: "" });
      await this.flush();
      this.completeUpgrade();
      await this.cache();
      return next;
    } catch (cause) { this.fail(cause); return null; }
    finally { this.publish({ busy: false }); }
  }

  cancelPreview() {
    // Continue only after checking the active file on the next flush.
    if (this.status.phase === "saved" || this.status.phase === "saving" || this.status.phase === "browser") {
      this.stopped = false;
      void this.flush();
    }
  }

  private completeUpgrade() {
    if (this.directory && !this.hasPendingChanges && !this.stopped && this.status.upgradeRequired) {
      this.publish({ upgradeCompleted: true });
    }
  }

  private recordLegacyChange(snapshot: LegacySnapshot) {
    this.pendingLegacy = snapshot;
    this.stopped = true;
    this.publish({ olderTabChanged: true, phase: "conflict", message: "An older Marzano tab changed your tasks. Close it, then review its changes here." });
  }

  checkLegacyChanges() {
    const latest = this.env.readLegacy?.();
    if (latest && latest.fingerprint !== this.legacyFingerprint) this.recordLegacyChange(latest);
  }

  getOlderTabData(): DataContents | null {
    this.checkLegacyChanges();
    return this.pendingLegacy?.contents ?? null;
  }

  async acceptOlderTabData(mode: "merge" | "replace", expected: DataContents, onApply: (contents: DataContents) => void) {
    this.checkLegacyChanges();
    if (!this.pendingLegacy) return false;
    if (dataKey(expected) !== dataKey(this.pendingLegacy.contents)) {
      this.publish({ message: "The older tab changed again. Cancel and review its changes once more." });
      return false;
    }
    const next = applyImport(mode, this.contents, this.pendingLegacy.contents);
    this.legacyFingerprint = this.pendingLegacy.fingerprint;
    this.pendingLegacy = null;
    this.contents = next;
    this.stopped = false;
    this.publish({ olderTabChanged: false, phase: this.directory ? "saving" : "browser", message: "" });
    onApply(next);
    await this.flush();
    return true;
  }

  async checkForChanges() {
    this.checkLegacyChanges();
    if (!this.directory || this.stopped) return;
    await this.queue;
    try {
      if (await readFolder(this.directory) !== this.baseline) {
        this.stopped = true;
        this.publish({ phase: "conflict", message: "The file changed outside Marzano. Reconnect to review it." });
      }
    } catch (cause) { this.fail(cause); }
  }
}

export function legacyContents(): DataContents {
  return { tasks: loadTasks(), tags: loadTags(), pomodoro: { settings: loadPomodoroSettings(), history: loadPomodoroHistory() } };
}

let boot: Promise<LocalDataStore> | undefined;
export function openLocalData(): Promise<LocalDataStore> {
  if (boot) return boot;
  boot = new Promise((resolve, reject) => {
    const open = async () => {
      const store = new LocalDataStore(legacyContents());
      await store.initialize();
      resolve(store);
    };
    if (!navigator.locks) { void open().catch(reject); return; }
    // A second editing tab could replace the shared pending cache. Hold this
    // lock for the lifetime of the document, not just for a filesystem write.
    void navigator.locks.request("marzano.editing", { ifAvailable: true }, async (lock) => {
      if (!lock) { reject(new Error("Marzano is already open in another tab. Close it, then reload this one.")); return; }
      await open();
      await new Promise<void>(() => {});
    }).catch(reject);
  });
  return boot;
}
