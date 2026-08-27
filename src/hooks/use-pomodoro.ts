import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  createInitialTimer,
  loadPomodoroHistory,
  loadPomodoroSettings,
  loadPomodoroTimer,
  POMODORO_HISTORY_LIMIT,
  phaseDurationMs,
  savePomodoroHistory,
  savePomodoroSettings,
  savePomodoroTimer,
  type FocusAllocation,
  type PomodoroPhase,
  type PomodoroSessionRecord,
  type PomodoroSettings,
  type PomodoroTimerState,
} from "@/lib/pomodoro";
import type { Task } from "@/lib/tasks";

interface FocusCredit {
  taskId: string;
  durationMs: number;
}

interface ClosedTimer {
  timer: PomodoroTimerState;
  credit: FocusCredit | null;
}

interface PhaseTransition {
  finishedPhase: PomodoroPhase;
  nextPhase: PomodoroPhase;
  shouldAutoStart: boolean;
  selectedTaskTitle: string | null;
}

export interface PomodoroController {
  settings: PomodoroSettings;
  timer: PomodoroTimerState;
  history: PomodoroSessionRecord[];
  now: number;
  remainingMs: number;
  selectedTask: Task | null;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
  selectTask: (taskId: string) => void;
  start: () => void;
  pause: () => void;
  restart: () => void;
  skip: () => void;
  detachCompletedTask: (taskId: string) => void;
  clearHistory: () => void;
  restoreState: (
    settings: PomodoroSettings,
    history: PomodoroSessionRecord[],
  ) => void;
  requestNotificationPermission: () => Promise<
    NotificationPermission | "unsupported"
  >;
}

const TIMER_TICK_MS = 1_000;
const MAX_TIMER_DELAY = 2_147_000_000;
const MAX_CATCH_UP_TRANSITIONS = 48;
const MAX_DURATION_MINUTES = 120;
const MAX_BREAK_INTERVAL = 12;
const DESKTOP_NOTIFICATION_TAG = "marzano-pomodoro-round";

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
}

function playCompletionChime(context: AudioContext) {
  const startAt = context.currentTime;

  [659.25, 880].forEach((frequency, index) => {
    const toneStartsAt = startAt + index * 0.16;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, toneStartsAt);
    gain.gain.setValueAtTime(0.0001, toneStartsAt);
    gain.gain.exponentialRampToValueAtTime(0.08, toneStartsAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStartsAt + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStartsAt);
    oscillator.stop(toneStartsAt + 0.25);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
  });
}

function freshSessionId(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function boundedInteger(
  value: number,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function normalizeSettings(settings: PomodoroSettings): PomodoroSettings {
  return {
    focusMinutes: boundedInteger(
      settings.focusMinutes,
      25,
      1,
      MAX_DURATION_MINUTES,
    ),
    shortBreakMinutes: boundedInteger(
      settings.shortBreakMinutes,
      5,
      1,
      MAX_DURATION_MINUTES,
    ),
    longBreakMinutes: boundedInteger(
      settings.longBreakMinutes,
      15,
      1,
      MAX_DURATION_MINUTES,
    ),
    longBreakInterval: boundedInteger(
      settings.longBreakInterval,
      4,
      2,
      MAX_BREAK_INTERVAL,
    ),
    autoStartBreaks: Boolean(settings.autoStartBreaks),
    autoStartFocus: Boolean(settings.autoStartFocus),
    notifications: Boolean(settings.notifications),
    desktopAlerts: Boolean(settings.desktopAlerts),
  };
}

function activeTask(tasks: Task[], taskId: string | null): Task | null {
  if (!taskId) return null;
  return tasks.find((task) => task.id === taskId && !task.completedAt) ?? null;
}

function addAllocation(
  allocations: FocusAllocation[],
  taskId: string,
  taskTitle: string,
  durationMs: number,
): FocusAllocation[] {
  const existingIndex = allocations.findIndex(
    (allocation) => allocation.taskId === taskId,
  );

  if (existingIndex === -1) {
    return [...allocations, { taskId, taskTitle, durationMs }];
  }

  return allocations.map((allocation, index) =>
    index === existingIndex
      ? {
          ...allocation,
          taskTitle,
          durationMs: allocation.durationMs + durationMs,
        }
      : allocation,
  );
}

/** Closes the currently running slice without deciding what comes next. */
function closeRunningTimer(
  timer: PomodoroTimerState,
  at: number,
  tasks: Task[],
): ClosedTimer {
  if (timer.status !== "running" || timer.activeStartedAt === null) {
    return { timer, credit: null };
  }

  const availableMs = Math.max(0, timer.plannedDurationMs - timer.accumulatedMs);
  const elapsedMs = Math.min(
    availableMs,
    Math.max(0, Math.round(at - timer.activeStartedAt)),
  );
  const accumulatedMs = Math.min(
    timer.plannedDurationMs,
    timer.accumulatedMs + elapsedMs,
  );

  if (
    timer.phase !== "focus" ||
    !timer.selectedTaskId ||
    elapsedMs === 0
  ) {
    return {
      timer: { ...timer, accumulatedMs, activeStartedAt: null },
      credit: null,
    };
  }

  const task = tasks.find(({ id }) => id === timer.selectedTaskId);
  const priorTitle = timer.allocations.find(
    ({ taskId }) => taskId === timer.selectedTaskId,
  )?.taskTitle;
  const taskTitle = task?.title ?? priorTitle ?? "Deleted task";

  return {
    timer: {
      ...timer,
      accumulatedMs,
      activeStartedAt: null,
      allocations: addAllocation(
        timer.allocations,
        timer.selectedTaskId,
        taskTitle,
        elapsedMs,
      ),
    },
    credit: { taskId: timer.selectedTaskId, durationMs: elapsedMs },
  };
}

function timerRemainingMs(timer: PomodoroTimerState, now: number): number {
  const runningMs =
    timer.status === "running" && timer.activeStartedAt !== null
      ? Math.max(0, now - timer.activeStartedAt)
      : 0;

  return Math.max(
    0,
    timer.plannedDurationMs - timer.accumulatedMs - runningMs,
  );
}

function focusRecord(
  timer: PomodoroTimerState,
  endedAt: number,
  completed: boolean,
): PomodoroSessionRecord | null {
  if (timer.phase !== "focus" || timer.accumulatedMs <= 0) return null;

  const startedAt = Math.min(
    endedAt,
    timer.phaseStartedAt ?? Math.max(0, endedAt - timer.accumulatedMs),
  );

  return {
    id: timer.sessionId,
    startedAt,
    endedAt: Math.max(startedAt, endedAt),
    durationMs: timer.accumulatedMs,
    plannedDurationMs: timer.plannedDurationMs,
    completed,
    allocations: timer.allocations.filter(
      (allocation) => allocation.durationMs > 0,
    ),
  };
}

function nextPhaseForFocus(
  completedFocusCount: number,
  settings: PomodoroSettings,
): PomodoroPhase {
  return completedFocusCount > 0 &&
    completedFocusCount % settings.longBreakInterval === 0
    ? "longBreak"
    : "shortBreak";
}

export function usePomodoro(
  tasks: Task[],
  onAddFocusTime: (taskId: string, durationMs: number) => void,
): PomodoroController {
  const [settings, setSettings] = useState(() =>
    normalizeSettings(loadPomodoroSettings()),
  );
  const [timer, setTimer] = useState(() => loadPomodoroTimer(settings));
  const [history, setHistory] = useState(loadPomodoroHistory);
  const [now, setNow] = useState(() => Date.now());

  const settingsRef = useRef(settings);
  const timerRef = useRef(timer);
  const tasksRef = useRef(tasks);
  const onAddFocusTimeRef = useRef(onAddFocusTime);
  const alertAudioRef = useRef<AudioContext | null>(null);
  const processedSessionsRef = useRef(
    new Set(history.map((record) => record.id)),
  );

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    onAddFocusTimeRef.current = onAddFocusTime;
  }, [onAddFocusTime]);

  useEffect(() => {
    savePomodoroSettings(settings);
  }, [settings]);

  useEffect(() => {
    savePomodoroTimer(timer);
  }, [timer]);

  useEffect(() => {
    savePomodoroHistory(history);
  }, [history]);

  const applyTimer = useCallback(
    (nextTimer: PomodoroTimerState, credit: FocusCredit | null = null) => {
      timerRef.current = nextTimer;
      setTimer(nextTimer);

      if (credit && credit.durationMs > 0) {
        onAddFocusTimeRef.current(credit.taskId, credit.durationMs);
      }
    },
    [],
  );

  const addHistoryRecord = useCallback(
    (record: PomodoroSessionRecord | null) => {
      if (!record) return;

      setHistory((current) =>
        [record, ...current.filter(({ id }) => id !== record.id)].slice(
          0,
          POMODORO_HISTORY_LIMIT,
        ),
      );
    },
    [],
  );

  const prepareAlertAudio = useCallback(() => {
    if (!settingsRef.current.notifications) return;

    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) return;

    try {
      const context = alertAudioRef.current ?? new AudioContextClass();
      alertAudioRef.current = context;
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      // In-app and desktop alerts still work without audio support.
    }
  }, []);

  const playAlertSound = useCallback(() => {
    const context = alertAudioRef.current;
    if (!context || context.state === "closed") return;

    const play = () => {
      try {
        playCompletionChime(context);
      } catch {
        // The visual notification remains available if audio playback fails.
      }
    };

    if (context.state === "running") {
      play();
      return;
    }

    void context.resume().then(play).catch(() => {});
  }, []);

  useEffect(
    () => () => {
      const context = alertAudioRef.current;
      if (context && context.state !== "closed") void context.close();
    },
    [],
  );

  const notify = useCallback((title: string, description: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.notifications) return;

    toast.info(title, { description, duration: 7_000 });
    playAlertSound();

    if (
      currentSettings.desktopAlerts &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(title, {
          body: description,
          tag: DESKTOP_NOTIFICATION_TAG,
          requireInteraction: true,
        });
      } catch {
        // The in-app notification remains available when the OS blocks one.
      }
    }
  }, [playAlertSound]);

  const announceTransition = useCallback(
    (transition: PhaseTransition) => {
      if (transition.finishedPhase === "focus") {
        const breakName =
          transition.nextPhase === "longBreak" ? "Long break" : "Short break";
        notify(
          "Focus complete",
          `${breakName} ${transition.shouldAutoStart ? "started" : "is ready"}.`,
        );
        return;
      }

      notify(
        "Break complete",
        transition.selectedTaskTitle
          ? `Focus ${transition.shouldAutoStart ? "started" : "is ready"} for “${transition.selectedTaskTitle}”.`
          : "Choose a task for your next focus.",
      );
    },
    [notify],
  );

  const advancePhase = useCallback(
    (
      closeAt: number,
      transitionAt: number,
      completed: boolean,
      announce: boolean,
    ) => {
      const current = timerRef.current;
      if (processedSessionsRef.current.has(current.sessionId)) return null;
      processedSessionsRef.current.add(current.sessionId);

      const closed = closeRunningTimer(current, closeAt, tasksRef.current);
      const finished = closed.timer;
      const currentSettings = settingsRef.current;
      const selected = activeTask(
        tasksRef.current,
        finished.selectedTaskId,
      );
      const completedFocusCount =
        finished.phase === "focus" && completed
          ? finished.completedFocusCount + 1
          : finished.completedFocusCount;
      const nextPhase =
        finished.phase === "focus"
          ? completed
            ? nextPhaseForFocus(completedFocusCount, currentSettings)
            : "shortBreak"
          : "focus";
      const shouldAutoStart =
        nextPhase === "focus"
          ? currentSettings.autoStartFocus && selected !== null
          : currentSettings.autoStartBreaks;
      const nextTimer: PomodoroTimerState = {
        phase: nextPhase,
        status: shouldAutoStart ? "running" : "idle",
        selectedTaskId: selected?.id ?? null,
        sessionId: freshSessionId(),
        phaseStartedAt: shouldAutoStart ? transitionAt : null,
        accumulatedMs: 0,
        activeStartedAt: shouldAutoStart ? transitionAt : null,
        plannedDurationMs: phaseDurationMs(nextPhase, currentSettings),
        completedFocusCount,
        allocations: [],
      };

      applyTimer(nextTimer, closed.credit);
      addHistoryRecord(focusRecord(finished, closeAt, completed));
      setNow(transitionAt);

      const transition: PhaseTransition = {
        finishedPhase: finished.phase,
        nextPhase,
        shouldAutoStart,
        selectedTaskTitle: selected?.title ?? null,
      };
      if (announce) announceTransition(transition);
      return transition;
    },
    [addHistoryRecord, announceTransition, applyTimer],
  );

  const finishExpiredTimer = useCallback(
    (at: number) => {
      let transitionCount = 0;
      let lastTransition: PhaseTransition | null = null;

      while (transitionCount < MAX_CATCH_UP_TRANSITIONS) {
        const current = timerRef.current;
        if (
          current.status !== "running" ||
          current.activeStartedAt === null ||
          timerRemainingMs(current, at) > 0
        ) {
          break;
        }

        const boundary =
          current.activeStartedAt +
          Math.max(0, current.plannedDurationMs - current.accumulatedMs);
        const transition = advancePhase(
          boundary,
          boundary,
          true,
          false,
        );
        if (!transition) break;

        lastTransition = transition;
        transitionCount += 1;
      }

      if (lastTransition) {
        setNow(at);
        announceTransition(lastTransition);
      }
    },
    [advancePhase, announceTransition],
  );

  const finishIfExpired = useCallback(
    (at: number): boolean => {
      const current = timerRef.current;
      if (
        current.status !== "running" ||
        timerRemainingMs(current, at) > 0
      ) {
        return false;
      }

      finishExpiredTimer(at);
      return true;
    },
    [finishExpiredTimer],
  );

  useEffect(() => {
    if (timer.status !== "running") return;

    const tick = () => {
      const nextNow = Date.now();
      setNow(nextNow);
      finishExpiredTimer(nextNow);
    };

    let completionTimer: number;
    const scheduleCompletion = () => {
      const remaining = timerRemainingMs(timerRef.current, Date.now());
      const delay = Math.min(remaining, MAX_TIMER_DELAY);

      completionTimer = window.setTimeout(
        remaining > MAX_TIMER_DELAY ? scheduleCompletion : tick,
        delay,
      );
    };

    let interval: number | null = null;
    const startVisibleTicks = () => {
      if (interval !== null || document.hidden) return;
      interval = window.setInterval(tick, TIMER_TICK_MS);
    };
    const stopVisibleTicks = () => {
      if (interval === null) return;
      window.clearInterval(interval);
      interval = null;
    };
    const tickWhenVisible = () => {
      if (!document.hidden) tick();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopVisibleTicks();
        return;
      }

      tick();
      startVisibleTicks();
    };

    scheduleCompletion();
    tick();
    startVisibleTicks();

    window.addEventListener("focus", tickWhenVisible);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(completionTimer);
      stopVisibleTicks();
      window.removeEventListener("focus", tickWhenVisible);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [finishExpiredTimer, timer.sessionId, timer.status]);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      const nextSettings = normalizeSettings({
        ...settingsRef.current,
        ...patch,
      });
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
    },
    [],
  );

  const selectTask = useCallback(
    (taskId: string) => {
      const selected = activeTask(tasksRef.current, taskId);
      if (!selected) return;

      const switchedAt = Date.now();
      finishIfExpired(switchedAt);
      const current = timerRef.current;
      if (current.selectedTaskId === taskId) return;

      if (current.phase === "focus" && current.status === "running") {
        const closed = closeRunningTimer(current, switchedAt, tasksRef.current);
        applyTimer(
          {
            ...closed.timer,
            selectedTaskId: taskId,
            status: "running",
            activeStartedAt: switchedAt,
          },
          closed.credit,
        );
        setNow(switchedAt);
        return;
      }

      applyTimer({ ...current, selectedTaskId: taskId });
    },
    [applyTimer, finishIfExpired],
  );

  const start = useCallback(() => {
    prepareAlertAudio();

    const current = timerRef.current;
    if (current.status === "running") return;
    if (
      current.phase === "focus" &&
      !activeTask(tasksRef.current, current.selectedTaskId)
    ) {
      return;
    }

    const startedAt = Date.now();
    if (timerRemainingMs(current, startedAt) <= 0) {
      advancePhase(startedAt, startedAt, true, true);
      return;
    }

    applyTimer({
      ...current,
      status: "running",
      phaseStartedAt: current.phaseStartedAt ?? startedAt,
      activeStartedAt: startedAt,
    });
    setNow(startedAt);
  }, [advancePhase, applyTimer, prepareAlertAudio]);

  const pause = useCallback(() => {
    const pausedAt = Date.now();
    if (finishIfExpired(pausedAt)) return;

    const current = timerRef.current;
    if (current.status !== "running") return;

    const closed = closeRunningTimer(current, pausedAt, tasksRef.current);
    applyTimer({ ...closed.timer, status: "paused" }, closed.credit);
    setNow(pausedAt);
  }, [applyTimer, finishIfExpired]);

  const restart = useCallback(() => {
    const restartedAt = Date.now();
    if (finishIfExpired(restartedAt)) return;

    const current = timerRef.current;
    if (processedSessionsRef.current.has(current.sessionId)) return;
    processedSessionsRef.current.add(current.sessionId);

    const closed = closeRunningTimer(current, restartedAt, tasksRef.current);
    const selected = activeTask(
      tasksRef.current,
      closed.timer.selectedTaskId,
    );
    const nextTimer: PomodoroTimerState = {
      phase: closed.timer.phase,
      status: "idle",
      selectedTaskId: selected?.id ?? null,
      sessionId: freshSessionId(),
      phaseStartedAt: null,
      accumulatedMs: 0,
      activeStartedAt: null,
      plannedDurationMs: phaseDurationMs(
        closed.timer.phase,
        settingsRef.current,
      ),
      completedFocusCount: closed.timer.completedFocusCount,
      allocations: [],
    };

    applyTimer(nextTimer, closed.credit);
    addHistoryRecord(focusRecord(closed.timer, restartedAt, false));
    setNow(restartedAt);
  }, [addHistoryRecord, applyTimer, finishIfExpired]);

  const skip = useCallback(() => {
    const skippedAt = Date.now();
    if (finishIfExpired(skippedAt)) return;
    advancePhase(skippedAt, skippedAt, false, false);
  }, [advancePhase, finishIfExpired]);

  const detachCompletedTask = useCallback(
    (taskId: string) => {
      const initial = timerRef.current;
      if (initial.selectedTaskId !== taskId) return;

      const detachedAt = Date.now();
      finishIfExpired(detachedAt);
      const current = timerRef.current;
      if (current.selectedTaskId !== taskId) return;

      if (current.phase === "focus" && current.status === "running") {
        const closed = closeRunningTimer(current, detachedAt, tasksRef.current);
        applyTimer(
          {
            ...closed.timer,
            selectedTaskId: null,
            status: "paused",
          },
          closed.credit,
        );
        setNow(detachedAt);
        return;
      }

      applyTimer({ ...current, selectedTaskId: null });
    },
    [applyTimer, finishIfExpired],
  );

  const clearHistory = useCallback(() => setHistory([]), []);

  /**
   * Adopts the settings and history from an imported backup. The timer starts
   * over rather than carrying on: the restored settings change the phase
   * lengths underneath it, and a round measured against the old ones is not a
   * round the new ones would recognise.
   */
  const restoreState = useCallback(
    (
      nextSettings: PomodoroSettings,
      nextHistory: PomodoroSessionRecord[],
    ) => {
      const normalized = normalizeSettings(nextSettings);
      settingsRef.current = normalized;
      setSettings(normalized);

      processedSessionsRef.current = new Set(
        nextHistory.map((record) => record.id),
      );
      setHistory(nextHistory);
      applyTimer(createInitialTimer(normalized));
    },
    [applyTimer],
  );

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported" as const;
    if (Notification.permission !== "default") return Notification.permission;

    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }, []);

  const selectedTask = useMemo(
    () => activeTask(tasks, timer.selectedTaskId),
    [tasks, timer.selectedTaskId],
  );
  const remainingMs = timerRemainingMs(timer, now);

  return {
    settings,
    timer,
    history,
    now,
    remainingMs,
    selectedTask,
    updateSettings,
    selectTask,
    start,
    pause,
    restart,
    skip,
    detachCompletedTask,
    clearHistory,
    restoreState,
    requestNotificationPermission,
  };
}
