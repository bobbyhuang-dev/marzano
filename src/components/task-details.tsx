import { createContext, useContext, useId, useState } from "react";
import { ChevronDown, FileText, ListChecks } from "lucide-react";

import { MarkdownDescription } from "@/components/markdown-description";
import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox";
import type { Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type Section = "description" | "subtasks";

interface DetailsState {
  open: Record<Section, boolean>;
  toggle: (section: Section) => void;
  /** Base for the `aria-controls` pairing, one per row. */
  id: string;
}

const DetailsContext = createContext<DetailsState | null>(null);

function useDetails() {
  const context = useContext(DetailsContext);
  if (!context) throw new Error("TaskDetails parts must sit inside <TaskDetails>");
  return context;
}

function hasDescription(task: Task) {
  return Boolean(task.description.trim());
}

/**
 * The row's outer box and the two open/closed flags. The description and the
 * checklist are separate things a reader opens separately, which is why this
 * is not one Radix collapsible: that only pairs one trigger with one content.
 */
function TaskDetails({
  task,
  className,
  children,
}: {
  task: Task;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState<Record<Section, boolean>>({
    description: false,
    subtasks: false,
  });
  if (!hasDescription(task) && task.subtasks.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <DetailsContext.Provider
      value={{
        open,
        id,
        toggle: (section) =>
          setOpen((current) => ({ ...current, [section]: !current[section] })),
      }}
    >
      <div className={className}>{children}</div>
    </DetailsContext.Provider>
  );
}

/**
 * One toggle, sized and coloured like the due date beside it so the meta line
 * stays one line of quiet facts: what the task has, and a chevron to open it.
 */
function DetailsToggle({
  section,
  label,
  children,
}: {
  section: Section;
  label: string;
  children: React.ReactNode;
}) {
  const { open, toggle, id } = useDetails();
  const expanded = open[section];

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={`${id}-${section}`}
      aria-label={label}
      onClick={() => toggle(section)}
      className={cn(
        "-mx-1.5 -my-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-ui outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70",
        expanded && "text-foreground",
      )}
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className={cn("size-4 shrink-0 transition-ui", expanded && "rotate-180")}
      />
    </button>
  );
}

/** The two toggles for the meta line; each renders only when it has something to open. */
function TaskDetailsTrigger({ task }: { task: Task }) {
  if (!hasDescription(task) && task.subtasks.length === 0) return null;
  const completed = task.subtasks.filter(
    (subtask) => subtask.completedAt !== null,
  ).length;

  return (
    <>
      {hasDescription(task) ? (
        <DetailsToggle
          section="description"
          label={`Description of ${task.title}`}
        >
          <FileText aria-hidden="true" className="size-4 shrink-0" />
          Description
        </DetailsToggle>
      ) : null}
      {task.subtasks.length > 0 ? (
        <DetailsToggle section="subtasks" label={`Subtasks of ${task.title}`}>
          <ListChecks aria-hidden="true" className="size-4 shrink-0" />
          <span className="tabular-nums">
            {completed}/{task.subtasks.length}
            <span className="sr-only"> subtasks completed</span>
          </span>
        </DetailsToggle>
      ) : null}
    </>
  );
}

/** The description and the checklist, each shown only while its toggle is open. */
function TaskDetailsContent({
  task,
  className,
  onSubtaskComplete,
}: {
  task: Task;
  className?: string;
  /** Omitted in Completed, where the saved checklist is read-only. */
  onSubtaskComplete?: (subtaskId: string, completed: boolean) => void;
}) {
  const context = useContext(DetailsContext);
  if (!context) return null;
  const { open, id } = context;
  const showDescription = open.description && hasDescription(task);
  const showSubtasks = open.subtasks && task.subtasks.length > 0;
  if (!showDescription && !showSubtasks) return null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-4 pb-3.5 sm:pb-4", className)}>
      {showDescription ? (
        <div id={`${id}-description`} className="min-w-0">
          <MarkdownDescription source={task.description} />
        </div>
      ) : null}
      {showSubtasks ? (
        <ul
          id={`${id}-subtasks`}
          aria-label={`Subtasks of ${task.title}`}
          className="flex min-w-0 flex-col gap-3"
        >
          {task.subtasks.map((subtask) => (
            <li key={subtask.id} className="flex min-w-0 items-start gap-2">
              {onSubtaskComplete ? (
                <Checkbox
                  className="-ml-3 -mt-2.5"
                  checked={subtask.completedAt !== null}
                  onCheckedChange={(checked) =>
                    onSubtaskComplete(subtask.id, checked)
                  }
                  aria-label={`Mark ${subtask.title} as ${subtask.completedAt ? "incomplete" : "complete"}`}
                />
              ) : (
                <span className="mt-0.5 shrink-0">
                  <span aria-hidden="true">
                    <CheckboxIndicator checked={subtask.completedAt !== null} />
                  </span>
                  <span className="sr-only">
                    {subtask.completedAt ? "Completed:" : "Incomplete:"}
                  </span>
                </span>
              )}
              <p
                className={cn(
                  "min-w-0 flex-1 break-words text-sm leading-6",
                  subtask.completedAt !== null &&
                    "text-muted-foreground line-through",
                )}
              >
                {subtask.title}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { TaskDetails, TaskDetailsContent, TaskDetailsTrigger };
