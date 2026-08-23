export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export type PomodoroStatus = "idle" | "running" | "paused";

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notifications: boolean;
  desktopAlerts: boolean;
}

/** Focus time assigned to a task, with its title retained if the task is deleted. */
export interface FocusAllocation {
  taskId: string;
  taskTitle: string;
  durationMs: number;
}

/** One finished or interrupted focus phase. Breaks are not part of focus history. */
export interface PomodoroSessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  plannedDurationMs: number;
  completed: boolean;
  allocations: FocusAllocation[];
}

/** Persisted timer state, sufficient to reconstruct elapsed time after a reload. */
export interface PomodoroTimerState {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  selectedTaskId: string | null;
  sessionId: string;
  phaseStartedAt: number | null;
  accumulatedMs: number;
  activeStartedAt: number | null;
  plannedDurationMs: number;
  completedFocusCount: number;
  allocations: FocusAllocation[];
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notifications: true,
  desktopAlerts: true,
};

export const POMODORO_SETTINGS_STORAGE_KEY = "todos.pomodoro.settings.v1";
export const POMODORO_TIMER_STORAGE_KEY = "todos.pomodoro.timer.v1";
export const POMODORO_HISTORY_STORAGE_KEY = "todos.pomodoro.history.v1";

/** Keeps local storage bounded while retaining enough recent data for trends. */
export const POMODORO_HISTORY_LIMIT = 500;

const MINUTE_MS = 60_000;
const MAX_DURATION_MINUTES = Math.floor(Number.MAX_SAFE_INTEGER / MINUTE_MS);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isDurationMinutes(value: unknown): value is number {
  return isPositiveInteger(value) && value <= MAX_DURATION_MINUTES;
}

function isPomodoroPhase(value: unknown): value is PomodoroPhase {
  return value === "focus" || value === "shortBreak" || value === "longBreak";
}

function isPomodoroStatus(value: unknown): value is PomodoroStatus {
  return value === "idle" || value === "running" || value === "paused";
}

function nullableTimestamp(value: unknown): number | null {
  return value === null || value === undefined
    ? null
    : isNonnegativeInteger(value)
      ? value
      : null;
}

function toSettings(value: unknown): PomodoroSettings {
  const candidate = isObject(value) ? value : {};

  return {
    focusMinutes: isDurationMinutes(candidate.focusMinutes)
      ? candidate.focusMinutes
      : DEFAULT_POMODORO_SETTINGS.focusMinutes,
    shortBreakMinutes: isDurationMinutes(candidate.shortBreakMinutes)
      ? candidate.shortBreakMinutes
      : DEFAULT_POMODORO_SETTINGS.shortBreakMinutes,
    longBreakMinutes: isDurationMinutes(candidate.longBreakMinutes)
      ? candidate.longBreakMinutes
      : DEFAULT_POMODORO_SETTINGS.longBreakMinutes,
    longBreakInterval: isPositiveInteger(candidate.longBreakInterval)
      ? candidate.longBreakInterval
      : DEFAULT_POMODORO_SETTINGS.longBreakInterval,
    autoStartBreaks:
      typeof candidate.autoStartBreaks === "boolean"
        ? candidate.autoStartBreaks
        : DEFAULT_POMODORO_SETTINGS.autoStartBreaks,
    autoStartFocus:
      typeof candidate.autoStartFocus === "boolean"
        ? candidate.autoStartFocus
        : DEFAULT_POMODORO_SETTINGS.autoStartFocus,
    notifications:
      typeof candidate.notifications === "boolean"
        ? candidate.notifications
        : DEFAULT_POMODORO_SETTINGS.notifications,
    desktopAlerts:
      typeof candidate.desktopAlerts === "boolean"
        ? candidate.desktopAlerts
        : DEFAULT_POMODORO_SETTINGS.desktopAlerts,
  };
}

function toAllocation(value: unknown): FocusAllocation | null {
  if (!isObject(value)) return null;
  if (!isNonEmptyString(value.taskId) || !isNonEmptyString(value.taskTitle)) {
    return null;
  }
  if (!isNonnegativeInteger(value.durationMs)) return null;

  return {
    taskId: value.taskId,
    taskTitle: value.taskTitle,
    durationMs: value.durationMs,
  };
}

function toAllocations(value: unknown): FocusAllocation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(toAllocation)
    .filter((allocation): allocation is FocusAllocation => allocation !== null);
}

function newSessionId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    // A durable-enough fallback for older browsers without randomUUID support.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function phaseDurationMs(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  const safeSettings = toSettings(settings);
  const minutes =
    phase === "focus"
      ? safeSettings.focusMinutes
      : phase === "shortBreak"
        ? safeSettings.shortBreakMinutes
        : safeSettings.longBreakMinutes;

  return minutes * MINUTE_MS;
}

export function createInitialTimer(
  settings: PomodoroSettings,
): PomodoroTimerState {
  const safeSettings = toSettings(settings);

  return {
    phase: "focus",
    status: "idle",
    selectedTaskId: null,
    sessionId: newSessionId(),
    phaseStartedAt: null,
    accumulatedMs: 0,
    activeStartedAt: null,
    plannedDurationMs: phaseDurationMs("focus", safeSettings),
    completedFocusCount: 0,
    allocations: [],
  };
}

/** Compact focus time for task rows and summary cards. */
export function formatFocusDuration(durationMs: number): string {
  const safeDuration =
    Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs) : 0;
  const totalMinutes = Math.floor(safeDuration / MINUTE_MS);

  if (safeDuration > 0 && totalMinutes === 0) return "<1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function readStoredValue(key: string): unknown {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? null : (JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The timer remains usable for the current session without local storage.
  }
}

export function loadPomodoroSettings(): PomodoroSettings {
  return toSettings(readStoredValue(POMODORO_SETTINGS_STORAGE_KEY));
}

export function savePomodoroSettings(settings: PomodoroSettings): void {
  writeStoredValue(POMODORO_SETTINGS_STORAGE_KEY, toSettings(settings));
}

function toTimerState(
  value: unknown,
  settings: PomodoroSettings,
): PomodoroTimerState {
  const initial = createInitialTimer(settings);
  if (!isObject(value)) return initial;

  const phase = isPomodoroPhase(value.phase) ? value.phase : initial.phase;
  const plannedDurationMs = isPositiveInteger(value.plannedDurationMs)
    ? value.plannedDurationMs
    : phaseDurationMs(phase, settings);
  const accumulatedMs = Math.min(
    plannedDurationMs,
    isNonnegativeInteger(value.accumulatedMs) ? value.accumulatedMs : 0,
  );
  const selectedTaskId =
    value.selectedTaskId === null || value.selectedTaskId === undefined
      ? null
      : isNonEmptyString(value.selectedTaskId)
        ? value.selectedTaskId
        : null;
  let status = isPomodoroStatus(value.status) ? value.status : "idle";
  let activeStartedAt = nullableTimestamp(value.activeStartedAt);

  // A running timer needs a timestamp to derive elapsed time. Downgrade an
  // incomplete stored state rather than accidentally counting from the epoch.
  if (status === "running" && activeStartedAt === null) {
    status = accumulatedMs > 0 ? "paused" : "idle";
  }
  if (phase === "focus" && status === "running" && selectedTaskId === null) {
    status = accumulatedMs > 0 ? "paused" : "idle";
  }
  if (status !== "running") activeStartedAt = null;

  const phaseStartedAt =
    nullableTimestamp(value.phaseStartedAt) ?? activeStartedAt;
  const storedAllocations = toAllocations(value.allocations);
  const allocationTotal = storedAllocations.reduce(
    (sum, allocation) => sum + allocation.durationMs,
    0,
  );
  const allocations =
    Number.isSafeInteger(allocationTotal) && allocationTotal <= accumulatedMs
      ? storedAllocations
      : [];

  return {
    phase,
    status,
    selectedTaskId,
    sessionId: isNonEmptyString(value.sessionId)
      ? value.sessionId
      : initial.sessionId,
    phaseStartedAt,
    accumulatedMs,
    activeStartedAt,
    plannedDurationMs,
    completedFocusCount: isNonnegativeInteger(value.completedFocusCount)
      ? value.completedFocusCount
      : 0,
    allocations,
  };
}

export function loadPomodoroTimer(
  settings: PomodoroSettings = loadPomodoroSettings(),
): PomodoroTimerState {
  return toTimerState(readStoredValue(POMODORO_TIMER_STORAGE_KEY), settings);
}

export function savePomodoroTimer(timer: PomodoroTimerState): void {
  writeStoredValue(
    POMODORO_TIMER_STORAGE_KEY,
    toTimerState(timer, DEFAULT_POMODORO_SETTINGS),
  );
}

function toSessionRecord(value: unknown): PomodoroSessionRecord | null {
  if (!isObject(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonnegativeInteger(value.startedAt)) return null;
  if (!isNonnegativeInteger(value.endedAt) || value.endedAt < value.startedAt) {
    return null;
  }
  if (!isNonnegativeInteger(value.durationMs)) return null;
  if (!isPositiveInteger(value.plannedDurationMs)) return null;
  if (value.durationMs === 0 || value.durationMs > value.plannedDurationMs) {
    return null;
  }
  if (typeof value.completed !== "boolean") return null;

  const allocations = toAllocations(value.allocations);
  const allocationTotal = allocations.reduce(
    (sum, allocation) => sum + allocation.durationMs,
    0,
  );
  if (!Number.isSafeInteger(allocationTotal) || allocationTotal > value.durationMs) {
    return null;
  }

  return {
    id: value.id,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    durationMs: value.durationMs,
    plannedDurationMs: value.plannedDurationMs,
    completed: value.completed,
    allocations,
  };
}

function toHistory(value: unknown): PomodoroSessionRecord[] {
  if (!Array.isArray(value)) return [];

  // A session id is stable across reloads. De-duplicating it also prevents a
  // development StrictMode replay from inflating statistics.
  const byId = new Map<string, PomodoroSessionRecord>();
  value.forEach((candidate) => {
    const record = toSessionRecord(candidate);
    if (!record) return;

    const existing = byId.get(record.id);
    if (!existing || record.endedAt >= existing.endedAt) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()]
    .sort((left, right) => right.endedAt - left.endedAt)
    .slice(0, POMODORO_HISTORY_LIMIT);
}

export function loadPomodoroHistory(): PomodoroSessionRecord[] {
  return toHistory(readStoredValue(POMODORO_HISTORY_STORAGE_KEY));
}

export function savePomodoroHistory(history: PomodoroSessionRecord[]): void {
  writeStoredValue(POMODORO_HISTORY_STORAGE_KEY, toHistory(history));
}
