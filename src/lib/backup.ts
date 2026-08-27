import {
  POMODORO_HISTORY_LIMIT,
  toHistory as toPomodoroHistory,
  toSettings as toPomodoroSettings,
  type PomodoroSessionRecord,
  type PomodoroSettings,
} from "@/lib/pomodoro";
import { isPresent, mergeById } from "@/lib/sync";
import { toTag, type Tag } from "@/lib/tags";
import { isActiveTask, toTask, type Task } from "@/lib/tasks";

/**
 * Everything the app persists that is the user's own, in one file. The theme,
 * the sidebar width and the running timer are deliberately left out: they are
 * how this browser is set up, not what the user wrote down, and restoring a
 * half-finished Pomodoro from a month-old file would be worse than not.
 */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tasks: Task[];
  tags: Tag[];
  pomodoro: {
    settings: PomodoroSettings;
    history: PomodoroSessionRecord[];
  };
}

/** The user's data as it lives in `App.tsx`, without the file envelope. */
export type BackupContents = Pick<Backup, "tasks" | "tags" | "pomodoro">;

export const BACKUP_FORMAT = "marzano.backup";
export const BACKUP_VERSION = 1;

/** Merging keeps both sides; replacing throws the current data away. */
export type ImportMode = "merge" | "replace";

export function createBackup(contents: BackupContents): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...contents,
  };
}

export function serializeBackup(backup: Backup): string {
  // Indented: a backup people can open and read is a backup they trust.
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(date = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;

  return `marzano-backup-${stamp}.json`;
}

export function downloadBackup(backup: Backup) {
  const blob = new Blob([serializeBackup(backup)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = backupFileName();
  link.click();
  // Revoked on the next frame: Safari has not finished reading the blob when
  // `click()` returns.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/** Thrown for a file that is not a backup, so the dialog can say which. */
export class BackupParseError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Reads a file back through the same validators storage uses, so a hand-edited
 * or half-corrupt backup loses only the records it cannot describe.
 */
export function parseBackup(text: string): BackupContents {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupParseError("That file is not valid JSON.");
  }

  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT) {
    throw new BackupParseError("That file is not a Marzano backup.");
  }

  if (
    typeof parsed.version === "number" &&
    parsed.version > BACKUP_VERSION
  ) {
    throw new BackupParseError(
      "That backup was written by a newer version of Marzano.",
    );
  }

  const pomodoro = isObject(parsed.pomodoro) ? parsed.pomodoro : {};

  return {
    tasks: toArray(parsed.tasks)
      .map(toTask)
      .filter((task): task is Task => task !== null),
    tags: toArray(parsed.tags)
      .map(toTag)
      .filter((tag): tag is Tag => tag !== null),
    pomodoro: {
      settings: toPomodoroSettings(pomodoro.settings),
      history: toPomodoroHistory(pomodoro.history),
    },
  };
}

export interface BackupSummary {
  openTasks: number;
  otherTasks: number;
  tags: number;
  sessions: number;
}

/** What the dialog shows before the user commits to an import. */
export function summarizeBackup(contents: BackupContents): BackupSummary {
  // Tombstones travel in the file so deletions survive a merge, but they are
  // not something to show anyone a count of.
  const present = contents.tasks.filter(isPresent);
  const open = present.filter(isActiveTask).length;

  return {
    openTasks: open,
    otherTasks: present.length - open,
    tags: contents.tags.filter(isPresent).length,
    sessions: contents.pomodoro.history.length,
  };
}

/**
 * A merge is last-write-wins per record, which is why `updatedAt` exists: two
 * browsers that have both been used since the backup was taken end up with the
 * newer copy of each task rather than one side winning wholesale.
 *
 * Pomodoro settings are the exception. They are a preference rather than a
 * record, so a merge leaves the ones in front of the user alone; only a replace
 * adopts the file's.
 */
export function applyImport(
  mode: ImportMode,
  current: BackupContents,
  incoming: BackupContents,
): BackupContents {
  if (mode === "replace") return incoming;

  return {
    tasks: mergeById(current.tasks, incoming.tasks),
    tags: mergeById(current.tags, incoming.tags),
    pomodoro: {
      settings: current.pomodoro.settings,
      // `toPomodoroHistory` de-duplicates on session id, sorts newest first and
      // caps the list, so a union of two histories comes out well-formed.
      history: toPomodoroHistory([
        ...current.pomodoro.history,
        ...incoming.pomodoro.history,
      ]).slice(0, POMODORO_HISTORY_LIMIT),
    },
  };
}
