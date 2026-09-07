import { useEffect, useState } from "react";
import { Check, CircleCheckBig, Clock3, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  TaskDetails,
  TaskDetailsContent,
  TaskDetailsTrigger,
} from "@/components/task-details";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import { TagChipList } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { useAnimating } from "@/hooks/use-animating";
import {
  byMostRecentlyCompleted,
  completedTaskExpiry,
  COMPLETED_RETENTION_DAYS,
  formatCompletedAt,
  formatRetentionLeft,
  isRetentionEndingSoon,
  type Task,
} from "@/lib/tasks";
import { listRowMotion } from "@/lib/motion";
import { formatFocusDuration } from "@/lib/pomodoro";
import { resolveTags, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

const LABEL_REFRESH_INTERVAL = 30_000;

/** Keeps “Completed 2 minutes ago” honest while the view stays open. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      LABEL_REFRESH_INTERVAL,
    );

    return () => window.clearInterval(timer);
  }, []);

  return now;
}

interface CompletedRowProps {
  task: Task;
  tagsById: Map<string, Tag>;
  now: number;
  onRestore: () => void;
  onDelete: () => void;
}

function CompletedRow({ task, tagsById, now, onRestore, onDelete }: CompletedRowProps) {
  const animating = useAnimating();
  const expiry = completedTaskExpiry(task);
  const endingSoon = expiry !== null && isRetentionEndingSoon(expiry, now);

  return (
    // Padding on the inner box, not the row: the row's height is what
    // animates when it is restored or deleted.
    <motion.li
      {...listRowMotion}
      {...animating.handlers}
      className={cn("relative", animating.active && "overflow-clip")}
    >
      <TaskDetails task={task}>
      <div className="flex items-start gap-3 py-2.5 sm:py-3">
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check strokeWidth={3} className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium leading-5 text-foreground">
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-xs text-muted-foreground">
              {task.completedAt
                ? formatCompletedAt(task.completedAt, now)
                : "Completed"}
              {expiry !== null ? (
                <>
                  <span aria-hidden="true" className="px-1.5">
                    ·
                  </span>
                  <span
                    className={cn(endingSoon && "font-medium text-destructive")}
                  >
                    {formatRetentionLeft(expiry, now)}
                  </span>
                </>
              ) : null}
            </p>
            {task.focusedMs > 0 ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                {formatFocusDuration(task.focusedMs)} focused
              </p>
            ) : null}
            <TagChipList tags={resolveTags(task.tagIds, tagsById)} />
            <TaskDetailsTrigger task={task} />
          </div>
        </div>
        <div className="flex shrink-0 items-center self-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={`Restore ${task.title}`}
            title="Restore task"
            onClick={onRestore}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
          <DeleteTaskDialog
            task={task}
            onDelete={onDelete}
            description={`This will delete “${task.title}” right away instead of waiting out the ${COMPLETED_RETENTION_DAYS} days. This action can’t be undone.`}
          />
        </div>
      </div>
      {/* Indented past the check mark and gap so it sits under the title. */}
      <TaskDetailsContent task={task} className="pl-8" />
      </TaskDetails>
    </motion.li>
  );
}

interface CompletedTaskListProps {
  tasks: Task[];
  tagsById: Map<string, Tag>;
  onRestore: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function CompletedTaskList({
  tasks,
  tagsById,
  onRestore,
  onDelete,
}: CompletedTaskListProps) {
  const now = useNow();
  const completed = [...tasks].sort(byMostRecentlyCompleted);

  return (
    <section aria-labelledby="completed-heading">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="completed-heading"
          className="text-sm font-semibold tracking-[-0.01em] text-foreground"
        >
          Recently completed
        </h2>
        <p className="text-xs text-muted-foreground">
          Deleted {COMPLETED_RETENTION_DAYS} days after you check them off
        </p>
      </div>
      <div>
        {completed.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CircleCheckBig className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">Nothing completed yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check a task off and it waits here in case you need it back.
            </p>
          </div>
        ) : (
          <ul
            className="-mt-2.5 divide-y divide-border sm:-mt-3"
            aria-label="Completed tasks"
          >
            <AnimatePresence initial={false}>
              {completed.map((task) => (
                <CompletedRow
                  key={task.id}
                  task={task}
                  tagsById={tagsById}
                  now={now}
                  onRestore={() => onRestore(task)}
                  onDelete={() => onDelete(task)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

export { CompletedTaskList };
