import { type DataContents } from "@/lib/data-file";
import { loadTasks, TASKS_STORAGE_KEY } from "@/lib/tasks";
import { loadTags, TAGS_STORAGE_KEY } from "@/lib/tags";
import { loadPomodoroHistory, loadPomodoroSettings, POMODORO_HISTORY_STORAGE_KEY, POMODORO_SETTINGS_STORAGE_KEY } from "@/lib/pomodoro";

export const LEGACY_DATA_KEYS = [TASKS_STORAGE_KEY, TAGS_STORAGE_KEY, POMODORO_SETTINGS_STORAGE_KEY, POMODORO_HISTORY_STORAGE_KEY];
const NOTICE_KEY = "marzano.folder-upgrade-notice.v1";

export interface LegacySnapshot {
  fingerprint: string;
  existingUser: boolean;
  contents: DataContents;
}

/** Read-only: retain every original key, including fields older validators don't understand. */
export function readLegacySnapshot(): LegacySnapshot {
  const contents = {
    tasks: loadTasks(), tags: loadTags(),
    pomodoro: { settings: loadPomodoroSettings(), history: loadPomodoroHistory() },
  };
  try {
    const raw = LEGACY_DATA_KEYS.map((key) => window.localStorage.getItem(key));
    return {
      fingerprint: JSON.stringify(raw), contents,
      existingUser: raw.some((value) => value !== null) || window.localStorage.getItem("marzano.guide.v1") !== null || window.localStorage.getItem("marzano.whats-new.v1") !== null,
    };
  } catch { return { fingerprint: "unavailable", existingUser: false, contents }; }
}

export function shouldShowStorageUpgrade(required: boolean, completed: boolean): boolean {
  if (!required || completed) return false;
  try { return window.localStorage.getItem(NOTICE_KEY) !== "seen"; }
  catch { return true; }
}

export function dismissStorageUpgrade() {
  try { window.localStorage.setItem(NOTICE_KEY, "seen"); }
  catch { /* A repeated notice is preferable to disrupting the task list. */ }
}
