import {
  differenceInCalendarDays,
  endOfDay,
  format,
  formatDistanceToNowStrict,
} from "date-fns";

import {
  isPresent,
  nowIso,
  purgeTombstones,
  type SyncMeta,
  toSyncMeta,
  touch,
} from "@/lib/sync";

export interface Task extends SyncMeta {
  id: string;
  title: string;
  /**
   * Either a full ISO instant when a time was picked, or a `yyyy-MM-dd` day when
   * the task is only due on that date. Day-only tasks come due at the end of it.
   */
  dueAt: string | null;
  remindedAt: string | null;
  /** ISO instant the task was checked off, or null while it is still on the list. */
  completedAt: string | null;
  /** Ids of the tags on this task, in no particular order. */
  tagIds: string[];
  /** Focus time attributed to this task by completed or partial Pomodoros. */
  focusedMs: number;
}

/** Applies a change to a task and stamps it for the next merge. */
export function touchTask(task: Task, changes: Partial<Task>): Task {
  return touch(task, changes);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** How long a completed task waits in the panel before it is deleted for good. */
export const COMPLETED_RETENTION_DAYS = 30;
/** Completed tasks this close to deletion are called out in the panel. */
const RETENTION_WARNING_DAYS = 7;

export function isDateOnlyDue(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

export const TASKS_STORAGE_KEY = "marzano.tasks.v1";

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/**
 * Reads one stored record. Fields saved by older versions -- or corrupted ones --
 * fall back to their empty value rather than dropping the whole task; only a
 * record with no usable name is discarded.
 */
export function toTask(value: unknown): Task | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<Task>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  if (typeof candidate.title !== "string" || !candidate.title.trim()) return null;

  return {
    ...toSyncMeta(candidate),
    id: candidate.id,
    title: candidate.title,
    dueAt:
      typeof candidate.dueAt === "string" && dueAtToDate(candidate.dueAt)
        ? candidate.dueAt
        : null,
    remindedAt: isIsoInstant(candidate.remindedAt) ? candidate.remindedAt : null,
    completedAt: isIsoInstant(candidate.completedAt)
      ? candidate.completedAt
      : null,
    tagIds: Array.isArray(candidate.tagIds)
      ? [...new Set(candidate.tagIds.filter(isNonEmptyString))]
      : [],
    focusedMs: isNonnegativeInteger(candidate.focusedMs)
      ? candidate.focusedMs
      : 0,
  };
}

export function loadTasks(): Task[] {
  try {
    const stored = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const tasks = parsed
      .map(toTask)
      .filter((task): task is Task => task !== null);

    // Time passes while the app is closed, so the retention window is applied
    // before anything is shown.
    return purgeExpiredTasks(tasks);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  try {
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // The app still works for the current session when storage is unavailable.
  }
}

export function createTask(
  title: string,
  dueAt: string | null,
  tagIds: string[] = [],
): Task {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    dueAt,
    remindedAt: null,
    completedAt: null,
    tagIds,
    focusedMs: 0,
    updatedAt: nowIso(),
    deletedAt: null,
  };
}

/** A task matches a tag filter when it carries any of the selected tags. */
export function hasAnyTag(task: Task, tagIds: string[]): boolean {
  return tagIds.some((tagId) => task.tagIds.includes(tagId));
}

export interface TagTaskCount {
  /** Tasks still on the list. */
  open: number;
  /** Including the ones already checked off. */
  total: number;
}

/** How much work sits behind each tag, for the tag lists and the filter. */
export function countTasksByTag(tasks: Task[]): Map<string, TagTaskCount> {
  const counts = new Map<string, TagTaskCount>();

  tasks.forEach((task) => {
    task.tagIds.forEach((tagId) => {
      const count = counts.get(tagId) ?? { open: 0, total: 0 };

      counts.set(tagId, {
        open: count.open + (isActiveTask(task) ? 1 : 0),
        total: count.total + 1,
      });
    });
  });

  return counts;
}

/** Drops a deleted tag from every task that referenced it. */
export function removeTagFromTasks(tasks: Task[], tagId: string): Task[] {
  let changed = false;

  const next = tasks.map((task) => {
    if (!task.tagIds.includes(tagId)) return task;

    changed = true;
    return touchTask(task, {
      tagIds: task.tagIds.filter((id) => id !== tagId),
    });
  });

  return changed ? next : tasks;
}

export function isActiveTask(task: Task): boolean {
  return isPresent(task) && task.completedAt === null;
}

/** When a completed task gets deleted, or null while it is still on the list. */
export function completedTaskExpiry(task: Task): number | null {
  if (!task.completedAt || !isPresent(task)) return null;

  const completed = Date.parse(task.completedAt);
  return Number.isNaN(completed)
    ? null
    : completed + COMPLETED_RETENTION_DAYS * DAY_MS;
}

/**
 * Retires completed tasks past their retention window and drops tombstones old
 * enough to be forgotten, keeping the array identity when nothing expired so
 * React state stays put.
 *
 * An expired task becomes a tombstone rather than vanishing: a device that has
 * been away still holds the original, and without the tombstone it would push
 * the task back onto every other device on the next merge.
 */
export function purgeExpiredTasks(tasks: Task[], now = Date.now()): Task[] {
  let changed = false;

  const retired = tasks.map((task) => {
    const expiry = completedTaskExpiry(task);
    if (expiry === null || expiry > now) return task;

    changed = true;
    // Stamped with the moment it expired, not with now, so every device
    // arrives at the same tombstone.
    const deletedAt = new Date(expiry).toISOString();
    return { ...task, deletedAt, updatedAt: deletedAt };
  });

  // `purgeTombstones` hands back the same array when nothing is dropped, so an
  // unremarkable sweep still returns the identity React is holding.
  return purgeTombstones(changed ? retired : tasks, now);
}

/** Most recently completed first, so the panel opens on the likeliest undo. */
export function byMostRecentlyCompleted(a: Task, b: Task): number {
  return Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? "");
}

export function formatCompletedAt(value: string, now = Date.now()): string {
  const completed = Date.parse(value);
  if (Number.isNaN(completed)) return "Completed";

  // A task checked off seconds ago reads better as "just now" than "3 seconds ago".
  return now - completed < 60_000
    ? "Completed just now"
    : `Completed ${formatDistanceToNowStrict(completed, { addSuffix: true })}`;
}

export function formatRetentionLeft(expiry: number, now = Date.now()): string {
  const remaining = expiry - now;
  if (remaining <= 0) return "Deleting now";

  const days = Math.ceil(remaining / DAY_MS);
  if (days > 1) return `Deletes in ${days} days`;

  const hours = Math.ceil(remaining / HOUR_MS);
  if (hours > 1) return `Deletes in ${hours} hours`;

  return "Deletes within the hour";
}

export function isRetentionEndingSoon(expiry: number, now = Date.now()): boolean {
  return expiry - now <= RETENTION_WARNING_DAYS * DAY_MS;
}

/** Local `Date` for a stored due value; day-only values land on local midnight. */
export function dueAtToDate(value: string): Date | null {
  if (isDateOnlyDue(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The moment a task comes due: the end of the day when no time was picked. */
export function dueAtToDeadline(value: string): number | null {
  const date = dueAtToDate(value);
  if (!date) return null;

  return isDateOnlyDue(value) ? endOfDay(date).getTime() : date.getTime();
}

export function isoToLocalDate(value: string | null): Date | undefined {
  if (!value) return undefined;

  const date = dueAtToDate(value);
  if (!date) return undefined;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isoToLocalTime(value: string | null): string {
  if (!value || isDateOnlyDue(value)) return "";

  const date = dueAtToDate(value);
  if (!date) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateToDueValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function localDateAndTimeToIso(
  date: Date,
  time: string,
): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const localDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  );

  const matchesRequestedLocalTime =
    localDate.getFullYear() === date.getFullYear() &&
    localDate.getMonth() === date.getMonth() &&
    localDate.getDate() === date.getDate() &&
    localDate.getHours() === hours &&
    localDate.getMinutes() === minutes;

  return matchesRequestedLocalTime ? localDate.toISOString() : null;
}

export function formatDueDate(value: string): string {
  const date = dueAtToDate(value);
  if (!date) return "";

  return isDateOnlyDue(value)
    ? format(date, "EEE, MMM d")
    : format(date, "EEE, MMM d 'at' h:mm a");
}

export function isTaskDue(task: Task, now = Date.now()): boolean {
  if (!task.dueAt) return false;

  const deadline = dueAtToDeadline(task.dueAt);
  return deadline !== null && deadline <= now;
}

/**
 * How close a due date is, in the steps a reader plans by. `overdue` agrees
 * with `isTaskDue`, so a day-only task stays `today` until the day is out and
 * a timed one turns over at its time; the rest is counted in local calendar
 * days, so a task due tomorrow morning is `tomorrow` at eleven at night too.
 */
export type DueUrgency = "overdue" | "today" | "tomorrow" | "soon" | "later";

/** Days ahead that still count as `soon`: the coming week. */
const SOON_DAYS = 7;

export function dueUrgency(value: string, now = Date.now()): DueUrgency {
  const deadline = dueAtToDeadline(value);
  if (deadline === null) return "later";
  if (deadline <= now) return "overdue";

  const days = differenceInCalendarDays(dueAtToDate(value)!, now);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return days <= SOON_DAYS ? "soon" : "later";
}

/** How the open task list is ordered: as it was entered, or by deadline. */
export type DueSort = "default" | "asc" | "desc";

export const DUE_SORT_STORAGE_KEY = "marzano.due-sort.v1";

function isDueSort(value: unknown): value is DueSort {
  return value === "default" || value === "asc" || value === "desc";
}

/** The sort outlives a reload: unlike a filter, it is a standing preference. */
export function loadDueSort(): DueSort {
  try {
    const stored = window.localStorage.getItem(DUE_SORT_STORAGE_KEY);
    return isDueSort(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

export function saveDueSort(sort: DueSort) {
  try {
    window.localStorage.setItem(DUE_SORT_STORAGE_KEY, sort);
  } catch {
    // The app still works for the current session when storage is unavailable.
  }
}

/**
 * Open tasks by deadline. A task with no due date has no place on a timeline, so
 * it sits below the dated ones whichever way they run rather than piling up at
 * whichever end happens to mean "empty"; tasks sharing a deadline, and the
 * undated block itself, keep the order they were added in.
 */
export function sortTasksByDue(tasks: Task[], sort: DueSort): Task[] {
  if (sort === "default") return tasks;

  const direction = sort === "asc" ? 1 : -1;

  return [...tasks].sort((a, b) => {
    const left = a.dueAt ? dueAtToDeadline(a.dueAt) : null;
    const right = b.dueAt ? dueAtToDeadline(b.dueAt) : null;

    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1;
    }

    return (left - right) * direction;
  });
}

/** What two tasks are compared on under a due-date sort; null for undated. */
function dueKey(task: Task): number | null {
  return task.dueAt ? dueAtToDeadline(task.dueAt) : null;
}

/**
 * The positions the task shown at `index` may be moved to. In manual order that
 * is the whole list. Under a due-date sort it is only the run of tasks that tie
 * with it: moving a task past a different deadline would put the list out of
 * the order it claims to be in, so the sort would just put it back.
 */
export function reorderBounds(
  tasks: Task[],
  sort: DueSort,
  index: number,
): { min: number; max: number } {
  if (sort === "default") return { min: 0, max: tasks.length - 1 };

  const key = dueKey(tasks[index]);
  let min = index;
  while (min > 0 && dueKey(tasks[min - 1]) === key) min -= 1;
  let max = index;
  while (max < tasks.length - 1 && dueKey(tasks[max + 1]) === key) max += 1;

  return { min, max };
}

export function canReorderTask(
  tasks: Task[],
  sort: DueSort,
  from: number,
  to: number,
): boolean {
  if (from < 0 || from >= tasks.length || to < 0 || to >= tasks.length) {
    return false;
  }

  const { min, max } = reorderBounds(tasks, sort, from);
  return to >= min && to <= max;
}

/**
 * Moves the task shown at `from` to `to`, where both index `shownIds` -- the
 * list as the reader sees it, which may be filtered or sorted -- rather than
 * the stored list. Only the tasks between the two positions change places, and
 * they trade the slots they already hold in the stored list, so a task hidden
 * by a filter stays where it was and a stable due-date sort keeps producing
 * the order the reader just made.
 */
export function reorderTasks(
  tasks: Task[],
  shownIds: string[],
  from: number,
  to: number,
): Task[] {
  if (from === to) return tasks;

  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const affected = shownIds.slice(low, high + 1);
  const moved = [...affected];
  const [id] = moved.splice(from - low, 1);
  moved.splice(to - low, 0, id);

  const affectedIds = new Set(affected);
  const slots: number[] = [];
  const byId = new Map<string, Task>();
  tasks.forEach((task, index) => {
    if (!affectedIds.has(task.id)) return;
    slots.push(index);
    byId.set(task.id, task);
  });
  // The shown list is older than the stored one: something in it is gone.
  if (slots.length !== moved.length) return tasks;

  const next = [...tasks];
  slots.forEach((slot, position) => {
    next[slot] = byId.get(moved[position])!;
  });
  return next;
}
