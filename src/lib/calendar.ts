import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import {
  dueAtToDate,
  dueAtToDeadline,
  isDateOnlyDue,
  localDateToDueValue,
  type Task,
} from "@/lib/tasks";

/** How much of the calendar is on screen at once. */
export type CalendarScope = "week" | "month";

export const CALENDAR_SCOPE_STORAGE_KEY = "marzano.calendar-scope.v1";

/**
 * Sunday, matching the due date picker: the two calendars sit a click apart and
 * a week that started on a different day in each would read as a bug.
 */
const WEEK_STARTS_ON = 0;

/** A month is always drawn as six weeks so the grid does not change height. */
const MONTH_WEEKS = 6;
const DAYS_IN_WEEK = 7;

/** The week a date falls in, as this calendar counts weeks. */
export function startOfCalendarWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

export function endOfCalendarWeek(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
}

function isCalendarScope(value: unknown): value is CalendarScope {
  return value === "week" || value === "month";
}

/** The scope outlives a reload: like the due sort, it is a standing preference. */
export function loadCalendarScope(): CalendarScope {
  try {
    const stored = window.localStorage.getItem(CALENDAR_SCOPE_STORAGE_KEY);
    return isCalendarScope(stored) ? stored : "month";
  } catch {
    return "month";
  }
}

export function saveCalendarScope(scope: CalendarScope) {
  try {
    window.localStorage.setItem(CALENDAR_SCOPE_STORAGE_KEY, scope);
  } catch {
    // The app still works for the current session when storage is unavailable.
  }
}

export interface CalendarDay {
  date: Date;
  /** `yyyy-MM-dd`, the key tasks are grouped under. */
  key: string;
  /** False for the days of the neighbouring months a month grid spills into. */
  inScope: boolean;
}

/** The weeks on screen, each a row of seven days. */
export type CalendarGrid = CalendarDay[][];

function toWeeks(days: Date[], anchor: Date, scope: CalendarScope): CalendarGrid {
  const weeks: CalendarGrid = [];

  for (let index = 0; index < days.length; index += DAYS_IN_WEEK) {
    weeks.push(
      days.slice(index, index + DAYS_IN_WEEK).map((date) => ({
        date,
        key: localDateToDueValue(date),
        inScope: scope === "week" || isSameMonth(date, anchor),
      })),
    );
  }

  return weeks;
}

/**
 * Today, as a day key. Read at render rather than built into the grid, so a tab
 * left open over midnight moves the marker without rebuilding anything.
 */
export function todayKey(): string {
  return localDateToDueValue(new Date());
}

/** The days on screen for an anchor date: its week, or its month by whole weeks. */
export function buildCalendarGrid(
  anchor: Date,
  scope: CalendarScope,
): CalendarGrid {
  const start = startOfCalendarWeek(
    scope === "week" ? anchor : startOfMonth(anchor),
  );
  const length = scope === "week" ? DAYS_IN_WEEK : MONTH_WEEKS * DAYS_IN_WEEK;

  return toWeeks(
    eachDayOfInterval({ start, end: addDays(start, length - 1) }),
    anchor,
    scope,
  );
}

/** The column headings, taken from the same week the grid is built from. */
export function weekdayNames(): { short: string; long: string }[] {
  const start = startOfCalendarWeek(new Date());

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = addDays(start, index);
    return { short: format(date, "EEEEEE"), long: format(date, "EEEE") };
  });
}

/** One period forward or back, whichever period the scope is showing. */
export function shiftAnchor(
  anchor: Date,
  scope: CalendarScope,
  periods: number,
): Date {
  return scope === "week"
    ? addWeeks(anchor, periods)
    : addMonths(anchor, periods);
}

/** What the toolbar calls the period on screen. */
export function formatCalendarRange(
  anchor: Date,
  scope: CalendarScope,
): string {
  if (scope === "month") return format(anchor, "MMMM yyyy");

  const start = startOfCalendarWeek(anchor);
  const end = endOfCalendarWeek(anchor);

  // A week that straddles a month -- or a year -- has to name both sides of it.
  if (!isSameYear(start, end)) {
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }

  const endFormat = isSameMonth(start, end) ? "d, yyyy" : "MMM d, yyyy";
  return `${format(start, "MMM d")} – ${format(end, endFormat)}`;
}

/** Whether a day sits inside the period the grid is drawing. */
export function isWithinGrid(grid: CalendarGrid, key: string): boolean {
  return grid.some((week) => week.some((day) => day.key === key));
}

/**
 * Which day stays selected once the grid has moved: the one that was selected if
 * it is still on screen, otherwise today, otherwise the day the period starts on
 * -- so the day panel is never reading a date the calendar is not showing.
 */
export function nextSelectedDay(grid: CalendarGrid, currentKey: string): string {
  if (isWithinGrid(grid, currentKey)) return currentKey;

  const today = todayKey();
  if (isWithinGrid(grid, today)) return today;

  const days = grid.flat();
  return (days.find((day) => day.inScope) ?? days[0]).key;
}

/** When a task comes due, for ordering; undated tasks never reach the grid. */
function dueOrder(task: Task): number {
  return (task.dueAt ? dueAtToDeadline(task.dueAt) : null) ?? 0;
}

/**
 * Tasks by the local day they are due on, soonest first within each day. Day-only
 * tasks come due at the end of their day, so they fall in below the timed ones
 * rather than opening the list.
 */
export function groupTasksByDay(tasks: Task[]): Map<string, Task[]> {
  const byDay = new Map<string, Task[]>();

  tasks.forEach((task) => {
    if (!task.dueAt) return;

    const date = dueAtToDate(task.dueAt);
    if (!date) return;

    const key = localDateToDueValue(date);
    const day = byDay.get(key);

    if (day) day.push(task);
    else byDay.set(key, [task]);
  });

  // Stable, so tasks sharing a deadline keep the order they were added in.
  byDay.forEach((day) => day.sort((a, b) => dueOrder(a) - dueOrder(b)));

  return byDay;
}

/**
 * The time on a task, short enough for a day cell: a task due on the day itself
 * has no time to show.
 */
export function formatDueTimeShort(value: string): string {
  if (isDateOnlyDue(value)) return "";

  const date = dueAtToDate(value);
  if (!date) return "";

  // "9 AM" rather than "9:00 AM": in a cell this narrow the zeroes cost a word.
  return format(date, date.getMinutes() === 0 ? "h a" : "h:mm a");
}
