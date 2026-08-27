import { BellRing, CalendarClock, CalendarOff, PencilLine } from "lucide-react";
import type { ReactNode } from "react";

import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import {
  TaskFormDialog,
  type TaskChanges,
} from "@/components/task-form-dialog";
import { TagChipList } from "@/components/tag-chip";
import { type TagValues } from "@/components/tag-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDate, isTaskDue, type Task } from "@/lib/tasks";
import { resolveTags, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

function TaskDueDate({ task }: { task: Task }) {
  const due = isTaskDue(task);

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm text-muted-foreground",
        due && "font-medium text-destructive",
      )}
    >
      {due ? (
        <BellRing aria-hidden="true" className="size-4 shrink-0" />
      ) : task.dueAt ? (
        <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <CalendarOff aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="break-words tabular-nums">
        {task.dueAt ? formatDueDate(task.dueAt) : "No due date"}
      </span>
      {due ? <span className="sr-only">, due now</span> : null}
    </p>
  );
}

interface TaskItemProps {
  task: Task;
  tags: Tag[];
  tagsById: Map<string, Tag>;
  onComplete: () => void;
  onSave: (changes: TaskChanges) => void;
  onDelete: () => void;
  onCreateTag: (values: TagValues) => Tag;
}

function TaskItem({
  task,
  tags,
  tagsById,
  onComplete,
  onSave,
  onDelete,
  onCreateTag,
}: TaskItemProps) {
  return (
    <li className="flex items-start gap-2 py-3.5 sm:gap-3 sm:py-4">
      {/* The 2.75rem hit area is pulled left so the circle itself, not the
          button around it, lines up with the heading above the list. */}
      <Checkbox
        className="-ml-3 -mt-2.5"
        checked={false}
        onCheckedChange={onComplete}
        aria-label={`Mark ${task.title} as complete`}
        title="Complete task"
      />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium leading-6 text-foreground">
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TaskDueDate task={task} />
          <TagChipList tags={resolveTags(task.tagIds, tagsById)} />
        </div>
      </div>
      {/* The checkbox tracks the title's first line, but the actions belong to
          the row as a whole, so they centre against its full height. */}
      <div className="flex shrink-0 items-center gap-0.5 self-center">
        <TaskFormDialog
          task={task}
          tags={tags}
          onSubmit={onSave}
          onCreateTag={onCreateTag}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${task.title}`}
              title="Edit task"
            >
              <PencilLine aria-hidden="true" />
            </Button>
          }
        />
        <DeleteTaskDialog task={task} onDelete={onDelete} />
      </div>
    </li>
  );
}

interface TaskListProps {
  tasks: Task[];
  tags: Tag[];
  tagsById: Map<string, Tag>;
  label: string;
  empty: ReactNode;
  onComplete: (task: Task) => void;
  onSave: (task: Task, changes: TaskChanges) => void;
  onDelete: (task: Task) => void;
  onCreateTag: (values: TagValues) => Tag;
}

/** The list of open tasks, shared by the task page and every tag's page. */
function TaskList({
  tasks,
  tags,
  tagsById,
  label,
  empty,
  onComplete,
  onSave,
  onDelete,
  onCreateTag,
}: TaskListProps) {
  return (
    <div>
      {tasks.length === 0 ? (
        empty
      ) : (
        // The first row's top padding would stack on the heading's margin and
        // open a gap twice the one above it, so the list absorbs one row's worth.
        <ul
          className="-mt-3.5 divide-y divide-border sm:-mt-4"
          aria-label={label}
        >
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              tags={tags}
              tagsById={tagsById}
              onComplete={() => onComplete(task)}
              onSave={(changes) => onSave(task, changes)}
              onDelete={() => onDelete(task)}
              onCreateTag={onCreateTag}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export { TaskList };
