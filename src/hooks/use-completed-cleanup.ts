import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

import { purgeExpiredTasks, type Task } from "@/lib/tasks";

// Retention is measured in days, so sweeping once an hour is precise enough and
// costs nothing: an unchanged list keeps its identity and re-renders nothing.
const SWEEP_INTERVAL = 60 * 60 * 1000;

/** Deletes completed tasks once they outlive the retention window. */
export function useCompletedCleanup(setTasks: Dispatch<SetStateAction<Task[]>>) {
  const purge = useCallback(() => {
    setTasks((currentTasks) => purgeExpiredTasks(currentTasks));
  }, [setTasks]);

  useEffect(() => {
    purge();

    const timer = window.setInterval(purge, SWEEP_INTERVAL);
    return () => window.clearInterval(timer);
  }, [purge]);

  useEffect(() => {
    // A tab left open for weeks catches up the moment it is looked at again.
    const purgeWhenVisible = () => {
      if (!document.hidden) purge();
    };

    window.addEventListener("focus", purgeWhenVisible);
    document.addEventListener("visibilitychange", purgeWhenVisible);

    return () => {
      window.removeEventListener("focus", purgeWhenVisible);
      document.removeEventListener("visibilitychange", purgeWhenVisible);
    };
  }, [purge]);
}
