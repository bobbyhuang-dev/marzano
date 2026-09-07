import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import breakCompleteSoundUrl from "@/assets/sounds/break-complete.mp3";
import focusCompleteSoundUrl from "@/assets/sounds/focus-complete.mp3";

import {
  createInitialTimer,
  loadPomodoroHistory,
  loadPomodoroSettings,
  loadPomodoroTimer,
  POMODORO_HISTORY_LIMIT,
  phaseDurationMs,
  savePomodoroTimer,
  loadAlertVolume,
  saveAlertVolume,
  toAlertVolume,
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
  previewAlertSound: (sound: AlertSound) => void;
  alertVolume: number;
  setAlertVolume: (volume: number) => void;
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

/**
 * Two different sounds, so the ear knows which way the round turned without
 * reading the toast: a short celebration when focus is done, a firmer alert
 * when the break is over and it is time to come back. Both are Google's
 * Material product sounds (see src/assets/sounds/LICENSE.md). They are
 * decoded once into buffers so the moment of the alert costs no fetch, and
 * the sample level is lifted a little, because these were mastered as UI
 * sounds for a phone in the hand rather than an alarm for someone who has
 * walked away from a laptop.
 */
export type AlertSound = "focus" | "break";

const ALERT_SOUND_URLS: Record<AlertSound, string> = {
  focus: focusCompleteSoundUrl,
  break: breakCompleteSoundUrl,
};
/**
 * Full volume is a big lift over the samples as shipped, which were mastered
 * quietly as phone UI sounds. A limiter after the gain is what makes that
 * safe: it catches the peaks the lift would otherwise push past full scale,
 * so the top of the slider is loud rather than distorted. The slider maps to
 * gain on a square curve, because equal steps of amplitude do not sound like
 * equal steps of loudness and a linear knob does everything in its top third.
 */
const ALERT_MAX_GAIN = 5;

function alertGain(volume: number): number {
  return ALERT_MAX_GAIN * volume * volume;
}

async function decodeAlertSound(
  context: AudioContext,
  sound: AlertSound,
): Promise<AudioBuffer> {
  const response = await fetch(ALERT_SOUND_URLS[sound]);
  if (!response.ok) throw new Error(`Alert sound ${sound} failed to load.`);
  return context.decodeAudioData(await response.arrayBuffer());
}

function playAlertBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  volume: number,
) {
  if (volume <= 0) return;

  const source = context.createBufferSource();
  const gain = context.createGain();
  const limiter = context.createDynamicsCompressor();

  source.buffer = buffer;
  gain.gain.value = alertGain(volume);
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  source.connect(gain);
  gain.connect(limiter);
  limiter.connect(context.destination);
  source.addEventListener(
    "ended",
    () => {
      source.disconnect();
      gain.disconnect();
      limiter.disconnect();
    },
    { once: true },
  );
  source.start();
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

  const availableMs = Math.max(
    0,
    timer.plannedDurationMs - timer.accumulatedMs,
  );
  const elapsedMs = Math.min(
    availableMs,
    Math.max(0, Math.round(at - timer.activeStartedAt)),
  );
  const accumulatedMs = Math.min(
    timer.plannedDurationMs,
    timer.accumulatedMs + elapsedMs,
  );

  if (timer.phase !== "focus" || !timer.selectedTaskId || elapsedMs === 0) {
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

  return Math.max(0, timer.plannedDurationMs - timer.accumulatedMs - runningMs);
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
  initial?: { settings: PomodoroSettings; history: PomodoroSessionRecord[] },
): PomodoroController {
  const [settings, setSettings] = useState(() =>
    normalizeSettings(initial?.settings ?? loadPomodoroSettings()),
  );
  const [timer, setTimer] = useState(() => loadPomodoroTimer(settings));
  const [history, setHistory] = useState(
    () => initial?.history ?? loadPomodoroHistory(),
  );
  const [now, setNow] = useState(() => Date.now());
  const [alertVolume, setAlertVolumeState] = useState(loadAlertVolume);

  const settingsRef = useRef(settings);
  const timerRef = useRef(timer);
  const tasksRef = useRef(tasks);
  const onAddFocusTimeRef = useRef(onAddFocusTime);
  const alertAudioRef = useRef<AudioContext | null>(null);
  const alertBuffersRef = useRef(new Map<AlertSound, Promise<AudioBuffer>>());
  const alertVolumeRef = useRef(alertVolume);
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
    savePomodoroTimer(timer);
  }, [timer]);

  useEffect(() => {
    alertVolumeRef.current = alertVolume;
    saveAlertVolume(alertVolume);
  }, [alertVolume]);

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

  const alertAudioContext = useCallback((): AudioContext | null => {
    const existing = alertAudioRef.current;
    if (existing && existing.state !== "closed") return existing;

    const AudioContextClass = audioContextConstructor();
    if (!AudioContextClass) return null;

    try {
      const context = new AudioContextClass();
      alertAudioRef.current = context;
      alertBuffersRef.current.clear();
      return context;
    } catch {
      // In-app and desktop alerts still work without audio support.
      return null;
    }
  }, []);

  const alertBuffer = useCallback(
    (context: AudioContext, sound: AlertSound): Promise<AudioBuffer> => {
      const buffers = alertBuffersRef.current;
      const pending = buffers.get(sound);
      if (pending) return pending;

      const loading = decodeAlertSound(context, sound).catch((error) => {
        // Let the next alert try again rather than pinning the failure.
        buffers.delete(sound);
        throw error;
      });
      buffers.set(sound, loading);
      return loading;
    },
    [],
  );

  /**
   * Creating the context inside the Start click is what lets the browser
   * unmute it: an AudioContext made without a user gesture stays suspended.
   * Asking for the notification permission here for the same reason, since
   * the prompt is only shown from a gesture and desktop alerts default to on,
   * so without this the setting would silently do nothing until the user
   * found the toggle.
   */
  const prepareAlerts = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.notifications) return;

    const context = alertAudioContext();
    if (context) {
      if (context.state === "suspended") void context.resume().catch(() => {});
      for (const sound of ["focus", "break"] as const) {
        void alertBuffer(context, sound).catch(() => {});
      }
    }

    if (
      currentSettings.desktopAlerts &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      try {
        void Notification.requestPermission().catch(() => {});
      } catch {
        // Older browsers only take a callback; the settings toggle still asks.
      }
    }
  }, [alertAudioContext, alertBuffer]);

  const playAlertSound = useCallback(
    (sound: AlertSound) => {
      // A page reloaded mid-round has no context yet; a later click anywhere
      // on the page is enough for the browser to let this one resume.
      const context = alertAudioContext();
      if (!context) return;

      const resumed =
        context.state === "running" ? Promise.resolve() : context.resume();
      void Promise.all([resumed, alertBuffer(context, sound)])
        .then(([, buffer]) =>
          playAlertBuffer(context, buffer, alertVolumeRef.current),
        )
        .catch(() => {
          // The visual notification remains available if playback fails.
        });
    },
    [alertAudioContext, alertBuffer],
  );

  useEffect(
    () => () => {
      const context = alertAudioRef.current;
      if (context && context.state !== "closed") void context.close();
    },
    [],
  );

  const notify = useCallback(
    (sound: AlertSound, title: string, description: string) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.notifications) return;

      toast.info(title, { description, duration: 7_000 });
      playAlertSound(sound);

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
    },
    [playAlertSound],
  );

  const announceTransition = useCallback(
    (transition: PhaseTransition) => {
      if (transition.finishedPhase === "focus") {
        const breakName =
          transition.nextPhase === "longBreak" ? "Long break" : "Short break";
        notify(
          "focus",
          "Focus complete",
          `${breakName} ${transition.shouldAutoStart ? "started" : "is ready"}.`,
        );
        return;
      }

      notify(
        "break",
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
      const selected = activeTask(tasksRef.current, finished.selectedTaskId);
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
        const transition = advancePhase(boundary, boundary, true, false);
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
      if (current.status !== "running" || timerRemainingMs(current, at) > 0) {
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

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    const nextSettings = normalizeSettings({
      ...settingsRef.current,
      ...patch,
    });
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }, []);

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
    prepareAlerts();

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
  }, [advancePhase, applyTimer, prepareAlerts]);

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
    const selected = activeTask(tasksRef.current, closed.timer.selectedTaskId);
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
    (nextSettings: PomodoroSettings, nextHistory: PomodoroSessionRecord[]) => {
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

  const previewAlertSound = useCallback(
    (sound: AlertSound) => {
      const context = alertAudioContext();
      if (context?.state === "suspended") void context.resume().catch(() => {});
      playAlertSound(sound);
    },
    [alertAudioContext, playAlertSound],
  );

  const setAlertVolume = useCallback((volume: number) => {
    const next = toAlertVolume(volume);
    // The ref is set here as well so a preview fired from the same gesture as
    // the change plays at the new level, not the one from the last render.
    alertVolumeRef.current = next;
    setAlertVolumeState(next);
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
    previewAlertSound,
    alertVolume,
    setAlertVolume,
  };
}
