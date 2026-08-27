import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, format } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { EmptyPanel } from "@/components/empty-panel";
import { type TagValues } from "@/components/tag-form-dialog";
import {
  TaskFormDialog,
  type TaskChanges,
} from "@/components/task-form-dialog";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  buildCalendarGrid,
  type CalendarDay,
  type CalendarScope,
  endOfCalendarWeek,
  formatCalendarRange,
  formatDueTimeShort,
  groupTasksByDay,
  isWithinGrid,
  nextSelectedDay,
  shiftAnchor,
  startOfCalendarWeek,
  todayKey,
  weekdayNames,
} from "@/lib/calendar";
import {
  dueAtToDate,
  isTaskDue,
  localDateToDueValue,
  type Task,
} from "@/lib/tasks";
import { resolveTags, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * How much of a day fits in its cell before it has to say how many are left over.
 * A week row is roughly twice the height of a month row, so it holds twice as
 * much of each day.
 *
 * The height is fixed rather than a minimum: a busy day that grew its own cell
 * would push its whole row taller than the rest of the grid, and leave its
 * shorter neighbours floating in an over-tall row. Each height is the room the
 * counts above need -- day number, that many titles, and the "+n more" line --
 * so nothing is clipped at the sizes we ask for; the clipping below is only
 * there so an unexpectedly tall cell loses its overflow instead of the layout.
 */
const CELL_LAYOUT: Record<
  CalendarScope,
  { titles: number; dots: number; height: string }
> = {
  month: { titles: 3, dots: 3, height: "h-16 sm:h-[7.75rem]" },
  week: { titles: 6, dots: 4, height: "h-24 sm:h-[12.5rem]" },
};

const SCOPE_OPTIONS: { id: CalendarScope; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

// Stable for the life of the page: the names of the weekdays do not move.
const WEEKDAYS = weekdayNames();

function taskCountLabel(count: number): string {
  if (count === 0) return "no tasks";
  return count === 1 ? "1 task" : `${count} tasks`;
}

interface ScopeToggleProps {
  value: CalendarScope;
  onValueChange: (scope: CalendarScope) => void;
}

/** Two options that exclude each other, so they sit out in the open as radios. */
function ScopeToggle({ value, onValueChange }: ScopeToggleProps) {
  return (
    <SegmentedControl
      aria-label="Calendar range"
      options={SCOPE_OPTIONS}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

interface DayCellProps {
  day: CalendarDay;
  tasks: Task[];
  tagsById: Map<string, Tag>;
  scope: CalendarScope;
  isToday: boolean;
  selected: boolean;
  focusable: boolean;
  onSelect: () => void;
}

/** One day: what it is called, and as much of what falls on it as will fit. */
function DayCell({
  day,
  tasks,
  tagsById,
  scope,
  isToday,
  selected,
  focusable,
  onSelect,
}: DayCellProps) {
  const layout = CELL_LAYOUT[scope];
  const titles = tasks.slice(0, layout.titles);
  const dots = tasks.slice(0, layout.dots);

  return (
    <td role="gridcell" aria-selected={selected} className="p-0 align-top">
      <button
        type="button"
        data-day={day.key}
        tabIndex={focusable ? 0 : -1}
        aria-current={isToday ? "date" : undefined}
        aria-label={`${format(day.date, "EEEE, MMMM d, yyyy")}, ${taskCountLabel(
          tasks.length,
        )}`}
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col items-stretch gap-1 overflow-hidden rounded-md border p-1 text-left transition-[color,background-color,border-color,box-shadow] duration-150 ease-out outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70 sm:gap-1.5 sm:p-1.5",
          layout.height,
          day.inScope
            ? "border-border bg-card hover:bg-accent/50"
            : "border-transparent hover:bg-accent/40",
          selected && "border-primary bg-primary/10 hover:bg-primary/15",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
            isToday
              ? "bg-primary text-primary-foreground"
              : day.inScope
                ? "text-foreground"
                : "text-muted-foreground/60",
          )}
        >
          {format(day.date, "d")}
        </span>

        {/* Below `sm` a cell is barely wider than a word, so the tasks show as
            dots and the day panel underneath does the reading. */}
        {tasks.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden">
            {dots.map((task) => (
              <TaskDot key={task.id} task={task} tagsById={tagsById} />
            ))}
            {tasks.length > layout.dots ? (
              <span className="text-[0.625rem] leading-none tabular-nums text-muted-foreground">
                +{tasks.length - layout.dots}
              </span>
            ) : null}
          </span>
        ) : null}

        {/* The count is what has to survive a squeeze, so the titles take the
            leftover room and clip, and the "+n more" line keeps its own. */}
        <span className="hidden min-w-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
          <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
            {titles.map((task) => (
              <TaskTitleChip key={task.id} task={task} tagsById={tagsById} />
            ))}
          </span>
          {tasks.length > layout.titles ? (
            <span className="shrink-0 px-1 text-[0.6875rem] leading-4 text-muted-foreground">
              +{tasks.length - layout.titles} more
            </span>
          ) : null}
        </span>
      </button>
    </td>
  );
}

function taskDotColor(task: Task, tagsById: Map<string, Tag>): string | undefined {
  return resolveTags(task.tagIds, tagsById)[0]?.color;
}

/** A task reduced to its tag colour, for cells with no room for its name. */
function TaskDot({ task, tagsById }: { task: Task; tagsById: Map<string, Tag> }) {
  const color = taskDotColor(task, tagsById);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 rounded-full",
        !color && (isTaskDue(task) ? "bg-destructive" : "bg-muted-foreground"),
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** A task as it reads inside a day cell: when it is due, then what it is. */
function TaskTitleChip({
  task,
  tagsById,
}: {
  task: Task;
  tagsById: Map<string, Tag>;
}) {
  const color = taskDotColor(task, tagsById);
  const time = task.dueAt ? formatDueTimeShort(task.dueAt) : "";
  const due = isTaskDue(task);

  return (
    <span
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[0.6875rem] leading-4",
        due ? "text-destructive" : "text-foreground/80",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          !color && (due ? "bg-destructive" : "bg-muted-foreground"),
        )}
        style={color ? { backgroundColor: color } : undefined}
      />
      {time ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>
      ) : null}
      <span className="truncate">{task.title}</span>
    </span>
  );
}

interface CalendarPageProps {
  /** Open tasks: the calendar is a view of the work still to do. */
  tasks: Task[];
  tags: Tag[];
  tagsById: Map<string, Tag>;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onAddTask: (changes: TaskChanges) => void;
  onCompleteTask: (task: Task) => void;
  onSaveTask: (task: Task, changes: TaskChanges) => void;
  onDeleteTask: (task: Task) => void;
  onCreateTag: (values: TagValues) => Tag;
}

/**
 * The task list laid out on the dates it is due. The grid is a preview -- a day
 * cell has room for names, not for controls -- so the day underneath it opens as
 * the same list the task page shows, with the same things to do to a task.
 *
 * Where in the calendar you happen to be looking is not app state: it is a
 * scroll position, and it starts again at today every time the page opens. Only
 * the range, week or month, is a preference worth keeping.
 */
function CalendarPage({
  tasks,
  tags,
  tagsById,
  scope,
  onScopeChange,
  onAddTask,
  onCompleteTask,
  onSaveTask,
  onDeleteTask,
  onCreateTag,
}: CalendarPageProps) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() =>
    localDateToDueValue(new Date()),
  );
  const gridRef = useRef<HTMLTableElement>(null);
  // Only a move made with the keyboard chases focus; clicking a day has already
  // put focus where it belongs.
  const focusSelectedRef = useRef(false);

  const grid = useMemo(
    () => buildCalendarGrid(anchor, scope),
    [anchor, scope],
  );
  const tasksByDay = useMemo(() => groupTasksByDay(tasks), [tasks]);

  useEffect(() => {
    if (!focusSelectedRef.current) return;

    focusSelectedRef.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${selectedKey}"]`)
      ?.focus();
  }, [selectedKey, grid]);

  const today = todayKey();
  const selectedDate = dueAtToDate(selectedKey) ?? new Date();
  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  // The grid can be paged away from the selected day, so the cell that answers
  // to Tab is whichever one the keyboard would land on.
  const focusKey = nextSelectedDay(grid, selectedKey);

  const goToDay = (date: Date, { focus = false } = {}) => {
    const key = localDateToDueValue(date);

    focusSelectedRef.current = focus;
    // A month spills into the weeks either side of it, and stepping onto one of
    // those days is not a reason to redraw the grid around it.
    if (!isWithinGrid(grid, key)) setAnchor(date);
    setSelectedKey(key);
  };

  const goToPeriod = (periods: number) => {
    const nextAnchor = shiftAnchor(anchor, scope, periods);

    setAnchor(nextAnchor);
    // Paging is browsing, not choosing: the day panel only moves when the day it
    // is showing scrolls off the grid.
    setSelectedKey(nextSelectedDay(buildCalendarGrid(nextAnchor, scope), selectedKey));
  };

  const selectScope = (nextScope: CalendarScope) => {
    onScopeChange(nextScope);
    // Whichever range comes up has to be the one holding the day on show.
    setAnchor(selectedDate);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(selectedDate, -1),
      ArrowRight: () => addDays(selectedDate, 1),
      ArrowUp: () => addDays(selectedDate, -7),
      ArrowDown: () => addDays(selectedDate, 7),
      Home: () => startOfCalendarWeek(selectedDate),
      End: () => endOfCalendarWeek(selectedDate),
      PageUp: () => shiftAnchor(selectedDate, scope, -1),
      PageDown: () => shiftAnchor(selectedDate, scope, 1),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    goToDay(move(), { focus: true });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label={scope === "week" ? "Previous week" : "Previous month"}
            title={scope === "week" ? "Previous week" : "Previous month"}
            onClick={() => goToPeriod(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label={scope === "week" ? "Next week" : "Next month"}
            title={scope === "week" ? "Next week" : "Next month"}
            onClick={() => goToPeriod(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <h2
            aria-live="polite"
            className="ml-1 min-w-0 truncate text-base font-semibold tracking-[-0.01em] text-foreground sm:text-lg"
          >
            {formatCalendarRange(anchor, scope)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToDay(new Date())}
          >
            Today
          </Button>
          <ScopeToggle value={scope} onValueChange={selectScope} />
        </div>
      </div>

      <div className="mt-4">
        <table
          ref={gridRef}
          role="grid"
          aria-label={`Tasks by day, ${formatCalendarRange(anchor, scope)}`}
          onKeyDown={handleKeyDown}
          className="w-full table-fixed border-separate border-spacing-1"
        >
          <thead>
            <tr role="row">
              {WEEKDAYS.map((weekday) => (
                <th
                  key={weekday.long}
                  role="columnheader"
                  scope="col"
                  className="pb-1 text-xs font-medium text-muted-foreground"
                >
                  <abbr title={weekday.long} className="no-underline">
                    {weekday.short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((week) => (
              <tr role="row" key={week[0].key}>
                {week.map((day) => (
                  <DayCell
                    key={day.key}
                    day={day}
                    tasks={tasksByDay.get(day.key) ?? []}
                    tagsById={tagsById}
                    scope={scope}
                    isToday={day.key === today}
                    selected={day.key === selectedKey}
                    focusable={day.key === focusKey}
                    onSelect={() => goToDay(day.date)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8" aria-labelledby="calendar-day-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2
              id="calendar-day-heading"
              className="text-sm font-semibold tracking-[-0.01em] text-foreground"
            >
              {format(selectedDate, "EEEE, MMMM d")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
              {selectedTasks.length === 0
                ? "Nothing due"
                : `${taskCountLabel(selectedTasks.length)} due`}
            </p>
          </div>
          <TaskFormDialog
            tags={tags}
            defaultDueAt={selectedKey}
            onSubmit={onAddTask}
            onCreateTag={onCreateTag}
            trigger={
              <Button>
                <Plus aria-hidden="true" />
                Add task
              </Button>
            }
          />
        </div>
        <TaskList
          tasks={selectedTasks}
          tags={tags}
          tagsById={tagsById}
          label={`Tasks due on ${format(selectedDate, "MMMM d, yyyy")}`}
          empty={
            <EmptyPanel
              icon={CalendarPlus}
              title="Nothing due"
              description="Pick another day, or put the first task on this one."
              action={
                <TaskFormDialog
                  tags={tags}
                  defaultDueAt={selectedKey}
                  onSubmit={onAddTask}
                  onCreateTag={onCreateTag}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus aria-hidden="true" />
                      Add task
                    </Button>
                  }
                />
              }
            />
          }
          onComplete={onCompleteTask}
          onSave={onSaveTask}
          onDelete={onDeleteTask}
          onCreateTag={onCreateTag}
        />
      </section>
    </>
  );
}

export { CalendarPage };
