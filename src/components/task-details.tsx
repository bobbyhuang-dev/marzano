import { ChevronDown, FileText, ListChecks } from "lucide-react";

import { MarkdownDescription } from "@/components/markdown-description";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

function TaskDetails({
  task,
  onSubtaskComplete,
}: {
  task: Task;
  /** Omitted in Completed, where the saved checklist is read-only. */
  onSubtaskComplete?: (subtaskId: string, completed: boolean) => void;
}) {
  const hasDescription = Boolean(task.description.trim());
  if (!hasDescription && task.subtasks.length === 0) return null;
  const completed = task.subtasks.filter(
    (subtask) => subtask.completedAt !== null,
  ).length;

  return (
    <Collapsible
      className={cn(
        "min-w-0 pb-3.5 sm:pb-4",
        onSubtaskComplete ? "pl-10 sm:pl-11" : "pl-8",
      )}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group -ml-3"
          aria-label={`Details for ${task.title}`}
        >
          <ChevronDown
            aria-hidden="true"
            data-icon="inline-start"
            className="transition-ui group-data-[state=open]:rotate-180"
          />
          {hasDescription ? (
            <>
              <FileText aria-hidden="true" />
              <span>Description</span>
            </>
          ) : null}
          {task.subtasks.length > 0 ? (
            <>
              <ListChecks aria-hidden="true" />
              <span className="tabular-nums">
                {completed}/{task.subtasks.length}
                <span className="sr-only"> subtasks completed</span>
              </span>
            </>
          ) : null}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0">
        <div className="flex min-w-0 flex-col gap-4 pt-2">
          <MarkdownDescription source={task.description} />
          {task.subtasks.length > 0 ? (
            <ul
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
                        <CheckboxIndicator
                          checked={subtask.completedAt !== null}
                        />
                      </span>
                      <span className="sr-only">
                        {subtask.completedAt ? "Completed:" : "Incomplete:"}
                      </span>
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p
                      className={cn(
                        "break-words text-sm leading-6",
                        subtask.completedAt !== null &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {subtask.title}
                    </p>
                    <MarkdownDescription source={subtask.description} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { TaskDetails };
