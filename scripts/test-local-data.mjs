// Exercise persistence failures without a browser or any third-party test runner.
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") && !url.includes("node_modules")) {
      return { format: "module", source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});

const { LocalDataStore } = await import("../src/lib/local-data.ts");
const { serializeData, parseData, dataKey } = await import("../src/lib/data-file.ts");
const { createTask, touchTask, createSubtask } = await import("../src/lib/tasks.ts");
const { DEFAULT_POMODORO_SETTINGS } = await import("../src/lib/pomodoro.ts");
const empty = () => ({ tasks: [], tags: [], pomodoro: { settings: { ...DEFAULT_POMODORO_SETTINGS }, history: [] } });
const data = (title = "Remember this") => ({ ...empty(), tasks: [createTask(title, null, [], "Notes", [createSubtask("First step")])] });
const missing = () => new DOMException("Missing", "NotFoundError");

class Directory {
  name = "Test folder";
  kind = "directory";
  files = new Map();
  dirs = new Map();
  permission = "granted";
  failClose = false;
  beforeClose;
  async queryPermission() { return this.permission; }
  async requestPermission() { return this.permission; }
  async isSameEntry(other) { return other === this; }
  async getFileHandle(name, options = {}) {
    if (this.permission !== "granted") throw new DOMException("Permission revoked", "NotAllowedError");
    if (!this.files.has(name)) { if (!options.create) throw missing(); this.files.set(name, ""); }
    return {
      name, kind: "file",
      getFile: async () => new File([this.files.get(name)], name),
      createWritable: async () => {
        let pending;
        return {
          write: async (text) => { pending = text; },
          close: async () => {
            if (this.beforeClose) { const callback = this.beforeClose; this.beforeClose = null; await callback(); }
            if (this.failClose) throw new Error("Disk full");
            this.files.set(name, pending);
          },
          abort: async () => {},
        };
      },
    };
  }
  async getDirectoryHandle(name, options = {}) {
    if (!this.dirs.has(name)) { if (!options.create) throw missing(); this.dirs.set(name, new Directory()); }
    return this.dirs.get(name);
  }
  async *values() { for (const name of this.files.keys()) yield { kind: "file", name }; }
  async removeEntry(name) { this.files.delete(name); }
}

function environment(initial = null) {
  let cached = initial;
  return {
    readCache: async () => cached,
    writeCache: async (next) => { cached = { ...next, contents: structuredClone(next.contents) }; },
    lock: async (action) => action(),
    get cached() { return cached; },
  };
}
const diskData = (folder) => parseData(folder.files.get("marzano.json"));

test("migrates browser records to a verified, readable file", async () => {
  const original = data(); const folder = new Directory(); const env = environment();
  const store = new LocalDataStore(original, env);
  await store.inspect(folder);
  assert.deepEqual(diskData(folder), original);
  assert.equal(store.getSnapshot().phase, "saved");
  assert.equal(store.hasPendingChanges, false);
  assert.deepEqual(env.cached.contents, original);
});

test("browser cleanup: an empty app previews the existing file without overwriting it", async () => {
  const folder = new Directory(); const original = data();
  const first = new LocalDataStore(original, environment()); await first.inspect(folder);
  const raw = folder.files.get("marzano.json");
  const clean = new LocalDataStore(empty(), environment()); await clean.initialize();
  const preview = await clean.inspect(folder);
  assert.equal(folder.files.get("marzano.json"), raw);
  await clean.accept(preview, "replace", () => {});
  assert.deepEqual(clean.contents, original);
  assert.equal(folder.files.get("marzano.json"), raw);
});

test("permission revocation preserves pending changes and reconnect saves them", async () => {
  const folder = new Directory(); const original = data(); const env = environment();
  const store = new LocalDataStore(original, env); await store.inspect(folder);
  const raw = folder.files.get("marzano.json"); folder.permission = "denied";
  const changed = { ...original, tasks: [...original.tasks, createTask("Pending", null, [])] };
  store.update(changed); await store.flush();
  assert.equal(store.getSnapshot().phase, "access");
  assert.equal(folder.files.get("marzano.json"), raw);
  assert.deepEqual(env.cached.contents, changed);
  folder.permission = "granted";
  const preview = await store.reconnect(); await store.accept(preview, "merge", () => {});
  assert.deepEqual(diskData(folder), changed);
});

test("failed close preserves the old primary and recovery copy; restart retries pending work", async () => {
  const folder = new Directory(); const original = data(); const env = environment();
  const store = new LocalDataStore(original, env); await store.inspect(folder);
  const raw = folder.files.get("marzano.json"); folder.failClose = true;
  const changed = { ...original, tasks: [...original.tasks, createTask("Unsaved", null, [])] };
  store.update(changed); await store.flush();
  assert.equal(store.getSnapshot().phase, "error"); assert.equal(store.hasPendingChanges, true); assert.equal(store.hasUnsavedChanges, true);
  assert.equal(folder.files.get("marzano.json"), raw);
  assert.equal([...folder.dirs.get("marzano-recovery").files.values()][0], raw);
  folder.failClose = false;
  const restored = new LocalDataStore(empty(), env); await restored.initialize();
  assert.deepEqual(diskData(folder), changed); assert.equal(restored.getSnapshot().phase, "saved");
});

test("external changes block saving until explicitly reviewed; merging keeps both sides", async () => {
  const folder = new Directory(); const original = data(); const store = new LocalDataStore(original, environment());
  await store.inspect(folder);
  const external = { ...original, tasks: [...original.tasks, createTask("Elsewhere", null, [])] };
  const externalRaw = serializeData(external); folder.files.set("marzano.json", externalRaw);
  store.update({ ...original, tasks: [...original.tasks, createTask("Here", null, [])] }); await store.flush();
  assert.equal(store.getSnapshot().phase, "conflict"); assert.equal(folder.files.get("marzano.json"), externalRaw);
  const preview = await store.reconnect(); await store.accept(preview, "merge", () => {});
  assert.equal(diskData(folder).tasks.length, 3);
});

test("restart reads a newer disk copy when browser cache has no pending changes", async () => {
  const folder = new Directory(); const env = environment(); const original = data();
  const store = new LocalDataStore(original, env); await store.inspect(folder);
  const changed = data("Changed elsewhere"); folder.files.set("marzano.json", serializeData(changed));
  const restored = new LocalDataStore(empty(), env); await restored.initialize();
  assert.deepEqual(restored.contents, changed);
});

test("restart keeps both copies when disk and browser contain unsaved divergent changes", async () => {
  const folder = new Directory(); const original = data(); const env = environment();
  const store = new LocalDataStore(original, env); await store.inspect(folder);
  folder.permission = "denied"; const pending = data("Pending here"); store.update(pending); await store.flush();
  folder.permission = "granted"; const raw = serializeData(data("Other browser")); folder.files.set("marzano.json", raw);
  const restored = new LocalDataStore(empty(), env); await restored.initialize();
  assert.equal(restored.getSnapshot().phase, "conflict"); assert.deepEqual(restored.contents, pending);
  assert.equal(folder.files.get("marzano.json"), raw);
});

test("deleted or malformed live files are never silently recreated", async () => {
  for (const broken of [null, "broken JSON", '{"format":"marzano.data","version":50}']) {
    const folder = new Directory(); const store = new LocalDataStore(data(), environment()); await store.inspect(folder);
    if (broken === null) folder.files.delete("marzano.json"); else folder.files.set("marzano.json", broken);
    await store.reconnect();
    assert.equal(store.getSnapshot().phase, "error");
    assert.equal(folder.files.get("marzano.json"), broken ?? undefined);
  }
});

test("a file changed after preview cannot be accepted", async () => {
  const folder = new Directory(); folder.files.set("marzano.json", serializeData(data()));
  const store = new LocalDataStore(empty(), environment()); const preview = await store.inspect(folder);
  const newer = serializeData(data("Newer")); folder.files.set("marzano.json", newer);
  assert.equal(await store.accept(preview, "replace", () => assert.fail("Must not apply")), null);
  assert.equal(folder.files.get("marzano.json"), newer);
});

test("edits arriving during a write are saved by the next queued operation", async () => {
  const folder = new Directory(); const store = new LocalDataStore(data(), environment()); await store.inspect(folder);
  const first = data("First"); const second = data("Second");
  folder.beforeClose = () => store.update(second);
  store.update(first); await store.flush(); await store.flush();
  assert.deepEqual(diskData(folder), second); assert.equal(store.getSnapshot().phase, "saved");
});

test("recovery retention removes only recognized old snapshots and keeps 24", async () => {
  const folder = new Directory(); const store = new LocalDataStore(data(), environment()); await store.inspect(folder);
  const recovery = await folder.getDirectoryHandle("marzano-recovery", { create: true });
  for (let day = 1; day <= 28; day++) recovery.files.set(`marzano-2020-01-${String(day).padStart(2, "0")}T00.json`, "old");
  recovery.files.set("my-notes.json", "user file");
  store.update(data("New")); await store.flush();
  assert.equal(recovery.files.size, 25); assert.equal(recovery.files.get("my-notes.json"), "user file");
});

test("IndexedDB failure still permits a verified file save and displays a recovery warning", async () => {
  const folder = new Directory(); const env = environment(); env.writeCache = async () => { throw new Error("Quota"); };
  const store = new LocalDataStore(data(), env); await store.inspect(folder);
  assert.equal(store.getSnapshot().phase, "saved"); assert.match(store.getSnapshot().cacheWarning, /unavailable/);
});

test("format roundtrip preserves subtasks, notes, manual order and tombstones", () => {
  const source = data(); source.tasks.push(touchTask(createTask("Deleted", null, []), { deletedAt: new Date().toISOString() }));
  assert.equal(dataKey(parseData(serializeData(source))), dataKey(source));
});

test("rejects lossy, duplicate and unknown-schema input before it can replace data", () => {
  const source = JSON.parse(serializeData(data()));
  for (const modified of [
    { ...source, version: 2 }, { ...source, tasks: null },
    { ...source, tasks: [...source.tasks, source.tasks[0]] },
    { ...source, tasks: [{ ...source.tasks[0], subtasks: [{ id: "broken" }] }] },
    { ...source, tasks: [{ ...source.tasks[0], futureField: "must not be lost" }] },
  ]) assert.throws(() => parseData(JSON.stringify(modified)));
});

test("version 1 and 2 backups remain readable", () => {
  const source = JSON.parse(serializeData(data())); source.format = "marzano.backup"; source.version = 2;
  assert.equal(parseData(JSON.stringify(source)).tasks.length, 1);
  source.version = 1; delete source.tasks[0].description; delete source.tasks[0].subtasks;
  assert.deepEqual(parseData(JSON.stringify(source)).tasks[0].subtasks, []);
});

test("oversized changes cannot replace the readable primary file", async () => {
  const folder = new Directory(); const original = data(); const store = new LocalDataStore(original, environment());
  await store.inspect(folder);
  const raw = folder.files.get("marzano.json");
  store.update({ ...original, tasks: [{ ...original.tasks[0], description: "x".repeat(21 * 1024 * 1024) }] });
  await store.flush();
  assert.equal(store.getSnapshot().phase, "error");
  assert.equal(folder.files.get("marzano.json"), raw);
});

const { readLegacySnapshot, shouldShowStorageUpgrade, dismissStorageUpgrade, LEGACY_DATA_KEYS } = await import("../src/lib/storage-upgrade.ts");
const { readCache, writeCache, RECOVERY_STORAGE_KEY } = await import("../src/lib/data-cache.ts");

function browserStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    values,
  };
}

function installLegacyBrowser(contents) {
  const storage = browserStorage();
  for (const [key, value] of [
    [LEGACY_DATA_KEYS[0], contents.tasks], [LEGACY_DATA_KEYS[1], contents.tags],
    [LEGACY_DATA_KEYS[2], contents.pomodoro.settings], [LEGACY_DATA_KEYS[3], contents.pomodoro.history],
  ]) storage.setItem(key, JSON.stringify(value));
  storage.setItem("marzano.theme.v1", "dark");
  storage.setItem("marzano.pomodoro.timer.v1", '{"status":"paused","sessionId":"existing-session"}');
  globalThis.window = { localStorage: storage };
  return storage;
}

test("first upgrade copies all existing data and leaves the original keys byte-for-byte unchanged", async (t) => {
  const oldWindow = globalThis.window; t.after(() => { globalThis.window = oldWindow; });
  const original = data("Existing task");
  original.tasks.push(createTask("Another task", "2027-02-01", ["tag-1"]));
  original.tags = [{ id: "tag-1", name: "Work", color: "#ef4444", updatedAt: new Date().toISOString(), deletedAt: null }];
  original.pomodoro.settings.focusMinutes = 45;
  original.pomodoro.history = [{ id: "session-1", startedAt: 1000, endedAt: 2000, durationMs: 1000, plannedDurationMs: 1000, completed: true, allocations: [] }];
  const storage = installLegacyBrowser(original); const before = new Map(storage.values);
  const env = environment(); env.readLegacy = readLegacySnapshot;
  const store = new LocalDataStore(empty(), env); await store.initialize();
  assert.deepEqual(store.contents, original);
  assert.deepEqual(env.cached.contents, original, "initial data must be cached even before an edit");
  assert.equal(store.getSnapshot().upgradeRequired, true);
  assert.equal(store.getSnapshot().upgradeCompleted, false);
  dismissStorageUpgrade(); store.cancelPreview(); await store.flush();
  const reloaded = new LocalDataStore(empty(), env); await reloaded.initialize();
  assert.deepEqual(reloaded.contents, original);
  const folder = new Directory(); await reloaded.inspect(folder);
  assert.deepEqual(diskData(folder), original);
  assert.equal(reloaded.getSnapshot().upgradeCompleted, true);
  for (const [key, value] of before) assert.equal(storage.getItem(key), value, key);
});

test("users who skip folder setup can edit and reload when IndexedDB is unavailable", async (t) => {
  const oldWindow = globalThis.window; t.after(() => { globalThis.window = oldWindow; });
  const original = data("Before deployment"); const storage = installLegacyBrowser(original);
  const before = new Map(storage.values);
  const env = { readCache, writeCache, readLegacy: readLegacySnapshot, lock: async (action) => action() };
  const store = new LocalDataStore(empty(), env); await store.initialize();
  const changed = { ...original, tasks: [...original.tasks, createTask("After deployment", null, [])] };
  store.update(changed); await store.flush();
  assert.equal(store.getSnapshot().cacheWarning, "");
  // Cached synchronously, so closing the tab loses nothing and must not prompt.
  assert.equal(store.hasUnsavedChanges, false);
  assert.ok(storage.getItem(RECOVERY_STORAGE_KEY));
  const reloaded = new LocalDataStore(empty(), env); await reloaded.initialize();
  assert.deepEqual(reloaded.contents, changed);
  for (const [key, value] of before) assert.equal(storage.getItem(key), value, key);
});

test("failed or canceled transfer never marks an existing user as migrated", async () => {
  const original = data(); const env = environment();
  env.readLegacy = () => ({ fingerprint: "old", existingUser: true, contents: original });
  const store = new LocalDataStore(original, env); await store.initialize();
  store.cancelPreview(); await store.flush();
  assert.equal(store.getSnapshot().upgradeCompleted, false);
  const folder = new Directory(); folder.failClose = true;
  await store.inspect(folder);
  assert.equal(store.getSnapshot().upgradeCompleted, false);
  assert.deepEqual(store.contents, original);
  assert.deepEqual(env.cached.contents, original);
});

test("existing matching folder completes setup only after its contents are reviewed", async () => {
  const original = data(); const env = environment();
  env.readLegacy = () => ({ fingerprint: "old", existingUser: true, contents: original });
  const store = new LocalDataStore(original, env); await store.initialize();
  const folder = new Directory(); folder.files.set("marzano.json", serializeData(original));
  const preview = await store.inspect(folder);
  assert.equal(store.getSnapshot().upgradeCompleted, false);
  await store.accept(preview, "merge", () => {});
  assert.equal(store.getSnapshot().upgradeCompleted, true);
  assert.equal(env.cached.upgrade.completed, true);
});

test("an old tab changing data pauses writes and survives restart for explicit review", async () => {
  const original = data(); const env = environment();
  let legacy = { fingerprint: "first", existingUser: true, contents: original };
  env.readLegacy = () => legacy;
  const store = new LocalDataStore(original, env); await store.initialize();
  const folder = new Directory(); await store.inspect(folder);
  const raw = folder.files.get("marzano.json");
  legacy = { ...legacy, fingerprint: "changed", contents: { ...original, tasks: [...original.tasks, createTask("From old tab", null, [])] } };
  store.checkLegacyChanges();
  assert.equal(store.getSnapshot().olderTabChanged, true);
  const here = { ...original, tasks: [...original.tasks, createTask("From new tab", null, [])] };
  store.update(here); await store.flush();
  assert.equal(folder.files.get("marzano.json"), raw);
  const restored = new LocalDataStore(empty(), env); await restored.initialize();
  assert.equal(restored.getSnapshot().olderTabChanged, true);
  assert.deepEqual(restored.contents, here);
  await restored.acceptOlderTabData("merge", restored.getOlderTabData(), () => {});
  assert.equal(diskData(folder).tasks.length, 3);
  assert.equal(restored.getSnapshot().olderTabChanged, false);
});

test("older-tab review rejects new edits arriving after the preview", async () => {
  const original = data(); const env = environment();
  let legacy = { fingerprint: "first", existingUser: true, contents: original };
  env.readLegacy = () => legacy;
  const store = new LocalDataStore(original, env); await store.initialize();
  legacy = { ...legacy, fingerprint: "second", contents: data("Second") };
  const preview = store.getOlderTabData();
  legacy = { ...legacy, fingerprint: "third", contents: data("Third") };
  assert.equal(await store.acceptOlderTabData("replace", preview, () => assert.fail()), false);
  assert.deepEqual(store.contents, original);
});

test("upgrade notice is shown once to existing users and never marks Later as completed", async (t) => {
  const oldWindow = globalThis.window; t.after(() => { globalThis.window = oldWindow; });
  globalThis.window = { localStorage: browserStorage() };
  assert.equal(shouldShowStorageUpgrade(false, false), false);
  assert.equal(shouldShowStorageUpgrade(true, false), true);
  dismissStorageUpgrade();
  assert.equal(shouldShowStorageUpgrade(true, false), false);
  assert.equal(shouldShowStorageUpgrade(true, true), false);
});

test("brand-new browsers remain new on reload and don't receive the upgrade notice", async (t) => {
  const oldWindow = globalThis.window; t.after(() => { globalThis.window = oldWindow; });
  globalThis.window = { localStorage: browserStorage() };
  const env = environment(); env.readLegacy = readLegacySnapshot;
  const store = new LocalDataStore(empty(), env); await store.initialize();
  assert.equal(store.getSnapshot().upgradeRequired, false);
  window.localStorage.setItem("marzano.guide.v1", "seen");
  const next = new LocalDataStore(empty(), env); await next.initialize();
  assert.equal(next.getSnapshot().upgradeRequired, false);
});

function indexedStorage(initial) {
  const state = { value: initial };
  return {
    state,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const transaction = { objectStore: () => ({
              get: () => {
                const result = { result: state.value };
                queueMicrotask(() => transaction.oncomplete());
                return result;
              },
              put: (value) => { state.value = value; queueMicrotask(() => transaction.oncomplete()); },
            }) };
            return transaction;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
}

test("newer fallback recovery cannot inherit a stale handle for a different folder", async (t) => {
  const oldWindow = globalThis.window; const oldIDB = globalThis.indexedDB;
  t.after(() => { globalThis.window = oldWindow; globalThis.indexedDB = oldIDB; });
  const fallback = browserStorage(); globalThis.window = { localStorage: fallback };
  const older = data("Older"); const newer = data("Newer");
  const directory = new Directory();
  globalThis.indexedDB = indexedStorage({ text: serializeData(older), directory, directoryId: "old-folder", baseline: null, revision: 10 });
  fallback.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ text: serializeData(newer), directoryId: "new-folder", baseline: null, revision: 20 }));
  const result = await readCache();
  assert.deepEqual(result.contents, newer);
  assert.equal(result.directory, null);
  fallback.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ text: serializeData(newer), directoryId: "old-folder", baseline: null, revision: 20 }));
  assert.equal((await readCache()).directory, directory);
});

test("a newer IndexedDB snapshot wins over a stale localStorage fallback", async (t) => {
  const oldWindow = globalThis.window; const oldIDB = globalThis.indexedDB;
  t.after(() => { globalThis.window = oldWindow; globalThis.indexedDB = oldIDB; });
  const storage = browserStorage(); globalThis.window = { localStorage: storage };
  const newer = data("Latest edit");
  globalThis.indexedDB = indexedStorage({ text: serializeData(newer), directory: null, baseline: null, revision: 30 });
  storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ text: serializeData(data("Stale")), baseline: null, revision: 20 }));
  assert.deepEqual((await readCache()).contents, newer);
});

test("corrupt recovery records stay untouched while original legacy data is shown", async (t) => {
  const oldWindow = globalThis.window; const oldIDB = globalThis.indexedDB;
  t.after(() => { globalThis.window = oldWindow; globalThis.indexedDB = oldIDB; });
  const original = data("Original legacy task"); const storage = installLegacyBrowser(original);
  const broken = { text: "unreadable", baseline: null, revision: 40 };
  const indexed = indexedStorage(broken); globalThis.indexedDB = indexed;
  storage.setItem(RECOVERY_STORAGE_KEY, "unreadable fallback");
  const store = new LocalDataStore(empty(), { readCache, writeCache, readLegacy: readLegacySnapshot, lock: async (action) => action() });
  await store.initialize();
  assert.deepEqual(store.contents, original);
  store.update(data("Temporary edit")); await store.flush();
  assert.equal(storage.getItem(RECOVERY_STORAGE_KEY), "unreadable fallback");
  assert.equal(indexed.state.value, broken);
  assert.match(store.getSnapshot().cacheWarning, /couldn’t be read/);
});

test("a full localStorage still permits IndexedDB recovery without changing legacy keys", async (t) => {
  const oldWindow = globalThis.window; const oldIDB = globalThis.indexedDB;
  t.after(() => { globalThis.window = oldWindow; globalThis.indexedDB = oldIDB; });
  const original = data(); const storage = installLegacyBrowser(original); const before = new Map(storage.values);
  storage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  globalThis.indexedDB = indexedStorage(null);
  const env = { readCache, writeCache, readLegacy: readLegacySnapshot, lock: async (action) => action() };
  const store = new LocalDataStore(empty(), env); await store.initialize();
  const next = data("Edit saved in IDB"); store.update(next); await store.flush();
  const restored = new LocalDataStore(empty(), env); await restored.initialize();
  assert.deepEqual(restored.contents, next);
  for (const [key, value] of before) assert.equal(storage.getItem(key), value);
});
