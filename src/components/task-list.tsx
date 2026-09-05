import { GripVertical, PencilLine } from "lucide-react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  useId,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  TaskDetails,
  TaskDetailsContent,
  TaskDetailsTrigger,
} from "@/components/task-details";
import { DeleteTaskDialog } from "@/components/delete-task-dialog";
import {
  TaskFormDialog,
  type TaskChanges,
} from "@/components/task-form-dialog";
import { TagChipList } from "@/components/tag-chip";
import { type TagValues } from "@/components/tag-form-dialog";
import { TaskDueDate } from "@/components/task-due-date";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAnimating } from "@/hooks/use-animating";
import { listRowMotion } from "@/lib/motion";
import {
  canReorderTask,
  reorderBounds,
  type DueSort,
  type Task,
} from "@/lib/tasks";
import { resolveTags, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * Lets the reader rearrange the list. `sort` decides how far a task may go:
 * anywhere in manual order, only among the tasks it ties with under a
 * due-date sort. `onMove` receives positions in the list as it is shown.
 */
interface ReorderOptions {
  sort: DueSort;
  onMove: (from: number, to: number) => void;
}

interface ReorderHandleProps {
  task: Task;
  hintId: string;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * The one place a row can be picked up from. The whole row cannot be draggable:
 * it holds a checkbox, two dialog triggers and selectable text, and on touch
 * every one of them is also how the page scrolls. `touch-none` is what lets a
 * finger drag the handle rather than the page.
 */
function ReorderHandle({ task, hintId, onPointerDown, onKeyDown }: ReorderHandleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Move ${task.title}`}
      aria-describedby={hintId}
      title="Drag to reorder"
      className="cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <GripVertical aria-hidden="true" />
    </Button>
  );
}

interface TaskItemProps {
  task: Task;
  tags: Tag[];
  tagsById: Map<string, Tag>;
  onComplete: () => void;
  onSubtaskComplete: (id: string, completed: boolean) => void;
  onSave: (changes: TaskChanges) => void;
  onDelete: () => void;
  onCreateTag: (values: TagValues) => Tag;
  /** Present only on a list that can be rearranged. */
  reorderable?: {
    hintId: string;
    dragging: boolean;
    onDraggingChange: (dragging: boolean) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  };
}

function TaskItem({
  task,
  tags,
  tagsById,
  onComplete,
  onSubtaskComplete,
  onSave,
  onDelete,
  onCreateTag,
  reorderable,
}: TaskItemProps) {
  const dragControls = useDragControls();
  const animating = useAnimating();

  const content = (
    <>
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
          <TaskDetailsTrigger task={task} />
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
        {reorderable ? (
          <ReorderHandle
            task={task}
            hintId={reorderable.hintId}
            onPointerDown={(event) => dragControls.start(event)}
            onKeyDown={reorderable.onKeyDown}
          />
        ) : null}
      </div>
    </>
  );

  // The padding sits on an inner box rather than the row: the row's height is
  // what animates as it joins or leaves the list, and padding on it would be
  // left standing at height zero.
  const row = (
    <TaskDetails task={task}>
      <div className="flex items-start gap-2 py-3.5 sm:gap-3 sm:py-4">{content}</div>
      {/* Indented past the checkbox and gap so it sits under the title. */}
      <TaskDetailsContent
        task={task}
        className="pl-10 sm:pl-11"
        onSubtaskComplete={onSubtaskComplete}
      />
    </TaskDetails>
  );

  if (!reorderable) {
    return (
      <motion.li
        {...listRowMotion}
        {...animating.handlers}
        className={cn("relative", animating.active && "overflow-clip")}
      >
        {row}
      </motion.li>
    );
  }

  return (
    // `relative` so the z-index Reorder gives the lifted row actually applies;
    // the surface and shadow are what say it is above the others. The card
    // grows outwards by the checkbox's pull-left (`-ml-3`) so the circle sits
    // inside it rather than on its edge, while the content stays put.
    <Reorder.Item
      as="li"
      value={task.id}
      dragListener={false}
      dragControls={dragControls}
      {...listRowMotion}
      {...animating.handlers}
      onDragStart={() => reorderable.onDraggingChange(true)}
      onDragEnd={() => reorderable.onDraggingChange(false)}
      className={cn(
        "relative",
        animating.active && "overflow-clip",
        reorderable.dragging &&
          "-mx-3 rounded-lg bg-background px-3 shadow-card",
      )}
    >
      {row}
    </Reorder.Item>
  );
}

interface TaskListProps {
  tasks: Task[];
  tags: Tag[];
  tagsById: Map<string, Tag>;
  label: string;
  empty: ReactNode;
  onComplete: (task: Task) => void;
  onSubtaskComplete: (task: Task, id: string, completed: boolean) => void;
  onSave: (task: Task, changes: TaskChanges) => void;
  onDelete: (task: Task) => void;
  onCreateTag: (values: TagValues) => Tag;
  reorder?: ReorderOptions;
}

/** The list of open tasks, shared by the task page and every tag's page. */
function TaskList({
  tasks,
  tags,
  tagsById,
  label,
  empty,
  onComplete,
  onSubtaskComplete,
  onSave,
  onDelete,
  onCreateTag,
  reorder,
}: TaskListProps) {
  const hintId = useId();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Reorder.Group ignores drags until it has rendered again after the last
  // one it reported, so a move this list declines has to re-render it anyway
  // or the row stays stuck to the pointer for the rest of the gesture.
  const [, setDeclined] = useState(0);

  const move = (from: number, to: number): boolean => {
    if (!reorder || !canReorderTask(tasks, reorder.sort, from, to)) return false;
    reorder.onMove(from, to);
    return true;
  };

  /**
   * Reorder reports the whole new order rather than which row moved; the row
   * that travelled furthest is the one under the pointer, the rest only
   * stepped aside for it.
   */
  const handleReorder = (nextIds: string[]) => {
    let from = -1;
    let to = -1;
    let furthest = 0;
    tasks.forEach((task, index) => {
      const next = nextIds.indexOf(task.id);
      const distance = Math.abs(next - index);
      if (next !== -1 && distance > furthest) {
        furthest = distance;
        from = index;
        to = next;
      }
    });

    if (from === -1 || !move(from, to)) setDeclined((count) => count + 1);
  };

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!reorder) return;

    const { min, max } = reorderBounds(tasks, reorder.sort, index);
    const target =
      event.key === "ArrowUp"
        ? index - 1
        : event.key === "ArrowDown"
          ? index + 1
          : event.key === "Home"
            ? min
            : event.key === "End"
              ? max
              : null;
    if (target === null) return;

    // The keys still scroll the page when there is nowhere to go, which is
    // the only feedback that the row has hit the edge of where it may sit.
    if (target < min || target > max || target === index) return;
    event.preventDefault();
    move(index, target);
  };

  // Both wrappers fade in, so trading the list for the empty panel -- a tag
  // filter that leaves nothing, the last task completed -- is a crossfade
  // rather than a cut.
  if (tasks.length === 0) return <div className="animate-fade-in">{empty}</div>;

  const rows = tasks.map((task, index) => (
    <TaskItem
      key={task.id}
      task={task}
      tags={tags}
      tagsById={tagsById}
      onComplete={() => onComplete(task)}
      onSubtaskComplete={(id, completed) => onSubtaskComplete(task, id, completed)}
      onSave={(changes) => onSave(task, changes)}
      onDelete={() => onDelete(task)}
      onCreateTag={onCreateTag}
      reorderable={
        reorder
          ? {
              hintId,
              dragging: draggingId === task.id,
              onDraggingChange: (dragging) =>
                setDraggingId(dragging ? task.id : null),
              onKeyDown: (event) => moveByKey(event, index),
            }
          : undefined
      }
    />
  ));

  // The first row's top padding would stack on the heading's margin and open
  // a gap twice the one above it, so the list absorbs one row's worth.
  const listClassName = "-mt-3.5 divide-y divide-border sm:-mt-4";

  if (!reorder) {
    return (
      <div className="animate-fade-in">
        <ul className={listClassName} aria-label={label}>
          <AnimatePresence initial={false}>{rows}</AnimatePresence>
        </ul>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <p id={hintId} className="sr-only">
        {reorder.sort === "default"
          ? "Drag, or press the up and down arrow keys, to move this task."
          : "Drag, or press the up and down arrow keys, to move this task among the tasks due at the same time."}
      </p>
      <Reorder.Group
        as="ul"
        axis="y"
        values={tasks.map((task) => task.id)}
        onReorder={handleReorder}
        aria-label={label}
        className={cn(listClassName, draggingId && "select-none")}
      >
        {/* Rows already on screen do not play an entrance; only a task that
            arrives -- added, restored, or let through a filter -- grows in. */}
        <AnimatePresence initial={false}>{rows}</AnimatePresence>
      </Reorder.Group>
    </div>
  );
}

export { TaskList };
