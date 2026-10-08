import { DEFAULT_PREFERENCES, parseBackup, type BackupContents } from "@/lib/backup";

export type DataContents = BackupContents;
export const DATA_FILE_NAME = "marzano.json";
const FORMAT = "marzano.data";
// Version 2 added `preferences` (the task sort) and version 3 each task's
// `importance`. Older readers must reject them rather than drop the fields on
// their next save.
const VERSION = 3;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function serializeData(contents: DataContents): string {
  const text = JSON.stringify({ format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), ...contents }, null, 2) + "\n";
  // Never report a successful save for a file that this version cannot reopen.
  if (new Blob([text]).size > MAX_FILE_BYTES) {
    throw new Error("Your data exceeds the 20 MB file limit. The existing file has been left untouched.");
  }
  return text;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)));
    }
    return entry;
  });
}

export const dataKey = (contents: DataContents) => canonical(contents);

/** Live files must never be silently repaired and then overwritten with lost fields. */
export function parseData(text: string): DataContents {
  if (new Blob([text]).size > MAX_FILE_BYTES) throw new Error("This file is too large to open (maximum 20 MB).");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("This file is not valid JSON. It has been left untouched."); }
  if (!value || typeof value !== "object") throw new Error("This is not a Marzano data file.");
  if (value.format !== FORMAT && value.format !== "marzano.backup") throw new Error("This is not a Marzano data file.");
  const maxVersion = value.format === FORMAT ? VERSION : 2;
  if (!Number.isInteger(value.version) || value.version < 1 || value.version > maxVersion) {
    throw new Error("This file uses an unsupported version. Update Marzano before opening it.");
  }
  // Backups and version 1 live files predate the preferences; every later file carries them.
  const hasPreferences = value.format === FORMAT && value.version >= 2;
  if (!Array.isArray(value.tasks) || !Array.isArray(value.tags) || !value.pomodoro ||
      !Array.isArray(value.pomodoro.history) || !value.pomodoro.settings ||
      (hasPreferences && (!value.preferences || typeof value.preferences !== "object"))) {
    throw new Error("This file is missing required data. It has been left untouched.");
  }
  const result = parseBackup(JSON.stringify({ ...value, format: "marzano.backup", version: 2 }));
  for (const records of [value.tasks, value.tags, value.pomodoro.history]) {
    if (new Set(records.map((entry: { id?: unknown } | null) => entry?.id)).size !== records.length) {
      throw new Error("This file contains duplicate records. It has been left untouched.");
    }
  }
  // Version 1 backups predate descriptions/subtasks, files before the
  // preferences get the defaults, and files before importance leave tasks
  // unmarked. Only those omissions are migrated.
  const source = {
    tasks: value.tasks, tags: value.tags, pomodoro: value.pomodoro,
    preferences: hasPreferences || value.preferences !== undefined ? value.preferences : DEFAULT_PREFERENCES,
  };
  if (value.format === "marzano.backup" && value.version === 1) {
    source.tasks = source.tasks.map((task: object) => ({ description: "", subtasks: [], ...task }));
  }
  // Every file before version 3 predates importance, so its tasks are unmarked.
  if (value.format === "marzano.backup" || value.version < 3) {
    source.tasks = source.tasks.map((task: object) => ({ importance: 0, ...task }));
  }
  if (canonical(source) !== canonical(result)) {
    throw new Error("This file contains invalid or unrecognized data. It has been left untouched.");
  }
  return result;
}

export async function readDataFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("This file is too large to open (maximum 20 MB).");
  const text = await file.text();
  parseData(text);
  return text;
}
