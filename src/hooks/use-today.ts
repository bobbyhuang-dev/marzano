import { startOfDay, startOfTomorrow } from "date-fns";
import { useSyncExternalStore } from "react";

const MAX_TIMER_DELAY = 2_147_000_000;

/**
 * One store for every subscriber rather than a timer per row: the day turns
 * over once, and a list of a few hundred tasks should learn about it from a
 * single timeout. Nothing runs while nobody is listening.
 */
const listeners = new Set<() => void>();
let timer: number | undefined;

function today(): number {
  return startOfDay(Date.now()).getTime();
}

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * Wakes just past local midnight, and re-arms from there. A machine that
 * sleeps through the boundary fires late, which is why the page also rechecks
 * when it is looked at again; and a day is well under the 32-bit limit, so the
 * clamp is only there to match the other background timers.
 */
function armMidnight() {
  const remaining = startOfTomorrow().getTime() - Date.now();

  timer = window.setTimeout(
    () => {
      notify();
      armMidnight();
    },
    Math.min(remaining + 1_000, MAX_TIMER_DELAY),
  );
}

function checkWhenVisible() {
  if (!document.hidden) notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    armMidnight();
    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    }
  };
}

/**
 * The start of the local day as a timestamp, re-rendering the caller when the
 * date changes so that anything labelled "today" or "tomorrow" is not left
 * saying so about yesterday. A store snapshot rather than state, so a render
 * for any other reason reads the clock afresh too.
 */
export function useToday(): number {
  return useSyncExternalStore(subscribe, today, today);
}
