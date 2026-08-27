import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";

import {
  dueAtToDeadline,
  formatDueDate,
  touchTask,
  type Task,
} from "@/lib/tasks";

const MAX_TIMER_DELAY = 2_147_000_000;

type DatedTask = Task & { dueAt: string };

/** A task is only worth reminding about while it is still on the list. */
function needsReminder(task: Task): task is DatedTask {
  return Boolean(task.dueAt) && !task.remindedAt && !task.completedAt;
}

export function useDueReminders(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
) {
  const notifyingKeys = useRef(new Set<string>());

  useEffect(() => {
    const pendingKeys = new Set(
      tasks.filter(needsReminder).map((task) => `${task.id}:${task.dueAt}`),
    );

    notifyingKeys.current.forEach((key) => {
      if (!pendingKeys.has(key)) notifyingKeys.current.delete(key);
    });
  }, [tasks]);

  const remindDueTasks = useCallback(() => {
    const now = Date.now();
    const dueTasks = tasks.filter((task) => {
      if (!needsReminder(task)) return false;
      if (notifyingKeys.current.has(`${task.id}:${task.dueAt}`)) return false;

      const deadline = dueAtToDeadline(task.dueAt);
      return deadline !== null && deadline <= now;
    });

    if (dueTasks.length === 0) return;

    dueTasks.forEach((task) => {
      notifyingKeys.current.add(`${task.id}:${task.dueAt}`);
      toast.info("Task due", {
        description: `“${task.title}” was due ${formatDueDate(task.dueAt!)}`,
        duration: 7_000,
      });
    });

    const remindedIds = new Set(dueTasks.map((task) => task.id));
    const remindedAt = new Date(now).toISOString();

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        remindedIds.has(task.id) && !task.remindedAt
          ? touchTask(task, { remindedAt })
          : task,
      ),
    );
  }, [setTasks, tasks]);

  useEffect(() => {
    const pendingTimes = tasks
      .filter(needsReminder)
      .map((task) => dueAtToDeadline(task.dueAt))
      .filter((deadline): deadline is number => deadline !== null);

    if (pendingTimes.length === 0) return;

    const nextDueTime = Math.min(...pendingTimes);
    let timer: number;

    const scheduleNextCheck = () => {
      const remaining = Math.max(0, nextDueTime - Date.now());

      if (remaining > MAX_TIMER_DELAY) {
        timer = window.setTimeout(scheduleNextCheck, MAX_TIMER_DELAY);
        return;
      }

      timer = window.setTimeout(remindDueTasks, remaining);
    };

    scheduleNextCheck();

    return () => window.clearTimeout(timer);
  }, [remindDueTasks, tasks]);

  useEffect(() => {
    const checkWhenVisible = () => {
      if (!document.hidden) remindDueTasks();
    };

    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [remindDueTasks]);
}
