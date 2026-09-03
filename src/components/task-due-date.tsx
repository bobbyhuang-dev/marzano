import { BellRing, CalendarClock, CalendarOff } from "lucide-react";

import { useToday } from "@/hooks/use-today";
import { dueUrgency, formatDueDate, type DueUrgency, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/**
 * The colour a due date is written in, by how near it is. Overdue is the
 * app's red and a far-off date is the same grey as any other secondary line,
 * so a list of dates only lights up where something is close.
 */
const URGENCY_CLASS: Record<DueUrgency, string> = {
  overdue: "font-medium text-destructive",
  today: "text-due-today",
  tomorrow: "text-due-tomorrow",
  soon: "text-due-soon",
  later: "text-muted-foreground",
};

/** Said aloud after the date, since the colour is invisible to a screen reader. */
const URGENCY_HINT: Partial<Record<DueUrgency, string>> = {
  overdue: "due now",
  today: "due today",
  tomorrow: "due tomorrow",
};

function useDueUrgency(dueAt: string | null): DueUrgency | null {
  // Subscribed only for the render at midnight. The clock itself is read
  // inside `dueUrgency`, as `isTaskDue` reads it: a timed task falls due on
  // the render the reminder causes, which is what turns the label red on time.
  useToday();
  return dueAt ? dueUrgency(dueAt) : null;
}

/** The date alone, coloured; for a row that has no room for the icon. */
function DueDateText({
  dueAt,
  className,
}: {
  dueAt: string | null;
  className?: string;
}) {
  const urgency = useDueUrgency(dueAt);
  const hint = urgency ? URGENCY_HINT[urgency] : undefined;

  return (
    <span className={cn(urgency ? URGENCY_CLASS[urgency] : URGENCY_CLASS.later, className)}>
      <span className="break-words tabular-nums">
        {dueAt ? formatDueDate(dueAt) : "No due date"}
      </span>
      {hint ? <span className="sr-only">, {hint}</span> : null}
    </span>
  );
}

/** A task's due date with its icon, coloured by how close it is. */
function TaskDueDate({ task }: { task: Task }) {
  const urgency = useDueUrgency(task.dueAt);

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm",
        urgency ? URGENCY_CLASS[urgency] : URGENCY_CLASS.later,
      )}
    >
      {urgency === "overdue" ? (
        <BellRing aria-hidden="true" className="size-4 shrink-0" />
      ) : task.dueAt ? (
        <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <CalendarOff aria-hidden="true" className="size-4 shrink-0" />
      )}
      <DueDateText dueAt={task.dueAt} />
    </p>
  );
}

export { DueDateText, TaskDueDate };
