import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  CircleCheckBig,
  ListTodo,
  PanelLeft,
  Plus,
  SearchX,
  Tags as TagsIcon,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { AppSidebar, type SidebarItem } from "@/components/app-sidebar";
import { CompletedTaskList } from "@/components/completed-task-list";
import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { DueSortMenu, SORT_OPTIONS } from "@/components/due-sort-menu";
import { EmptyPanel } from "@/components/empty-panel";
import { type TaskChanges } from "@/components/edit-task-dialog";
import { PomodoroPage } from "@/components/pomodoro-page";
import { TagFilterMenu } from "@/components/tag-filter-menu";
import { type TagValues } from "@/components/tag-form-dialog";
import {
  TagPickerDialog,
  TagSelectTrigger,
} from "@/components/tag-picker-dialog";
import { TagDetailPage, TagsPage } from "@/components/tags-page";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { useCompletedCleanup } from "@/hooks/use-completed-cleanup";
import { useDueReminders } from "@/hooks/use-due-reminders";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { useTheme } from "@/hooks/use-theme";
import {
  COMPLETED_RETENTION_DAYS,
  countTasksByTag,
  createTask,
  type DueSort,
  formatDueDate,
  hasAnyTag,
  isActiveTask,
  loadDueSort,
  loadTasks,
  removeTagFromTasks,
  saveDueSort,
  saveTasks,
  sortTasksByDue,
  type Task,
} from "@/lib/tasks";
import {
  createTag,
  loadTags,
  resolveTags,
  saveTags,
  tagsById as toTagsById,
  type Tag,
} from "@/lib/tags";
import { type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ViewId = "tasks" | "pomodoro" | "completed" | "tags";

const THEME_ANNOUNCEMENTS: Record<ThemePreference, string> = {
  system: "Theme now follows your system.",
  light: "Theme set to light.",
  dark: "Theme set to dark.",
};

const VIEW_TITLES: Record<ViewId, string> = {
  tasks: "Tasks",
  pomodoro: "Pomodoro",
  completed: "Completed",
  tags: "Tags",
};

function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [tags, setTags] = useState<Tag[]>(loadTags);
  const addFocusedTime = useCallback((taskId: string, durationMs: number) => {
    if (!Number.isFinite(durationMs)) return;

    const safeDuration = Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, Math.round(durationMs)),
    );
    if (safeDuration === 0) return;

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) return task;

        const currentDuration = Number.isSafeInteger(task.focusedMs)
          ? Math.max(0, task.focusedMs)
          : 0;
        const focusedMs =
          safeDuration > Number.MAX_SAFE_INTEGER - currentDuration
            ? Number.MAX_SAFE_INTEGER
            : currentDuration + safeDuration;

        return { ...task, focusedMs };
      }),
    );
  }, []);
  const pomodoro = usePomodoro(tasks, addFocusedTime);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [view, setView] = useState<ViewId>("tasks");
  /** The tag whose own page is open, or null while the tag list is showing. */
  const [openTagId, setOpenTagId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [dueSort, setDueSort] = useState<DueSort>(loadDueSort);
  const [menuOpen, setMenuOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueValue, setDueValue] = useState<string | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const dueId = useId();
  const errorId = `${titleId}-error`;

  const activeTasks = tasks.filter(isActiveTask);
  const completedTasks = tasks.filter((task) => !isActiveTask(task));
  const orderedActiveTasks = sortTasksByDue(activeTasks, dueSort);
  const visibleTasks =
    tagFilter.length === 0
      ? orderedActiveTasks
      : orderedActiveTasks.filter((task) => hasAnyTag(task, tagFilter));

  const tagsById = toTagsById(tags);
  const tagCounts = countTasksByTag(tasks);
  const openTag =
    view === "tags" && openTagId ? (tagsById.get(openTagId) ?? null) : null;
  const draftTags = resolveTags(draftTagIds, tagsById);

  useDueReminders(tasks, setTasks);
  useCompletedCleanup(setTasks);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveTags(tags);
  }, [tags]);

  useEffect(() => {
    saveDueSort(dueSort);
  }, [dueSort]);

  const navItems: SidebarItem[] = [
    {
      id: "tasks",
      label: VIEW_TITLES.tasks,
      icon: ListTodo,
      count: activeTasks.length,
    },
    {
      id: "pomodoro",
      label: VIEW_TITLES.pomodoro,
      icon: Timer,
    },
    {
      // No count: unlike the outstanding work, neither an archive tally nor a
      // count of the labels themselves is something to act on.
      id: "tags",
      label: VIEW_TITLES.tags,
      icon: TagsIcon,
    },
    {
      id: "completed",
      label: VIEW_TITLES.completed,
      icon: CircleCheckBig,
    },
  ];

  const selectView = (id: string) => {
    setView(id as ViewId);
    // The sidebar always lands on a view's own front page.
    setOpenTagId(null);
  };

  const handleAddTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Enter a task name.");
      titleInputRef.current?.focus();
      return;
    }

    setTasks((currentTasks) => [
      ...currentTasks,
      createTask(trimmedTitle, dueValue, draftTagIds),
    ]);
    setTitle("");
    setDueValue(null);
    setDraftTagIds([]);
    setError("");
    setStatusMessage(`Added ${trimmedTitle}.`);
    titleInputRef.current?.focus();
  };

  const setCompletedAt = (taskId: string, completedAt: string | null) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completedAt } : task,
      ),
    );
  };

  const restoreTask = (task: Task) => {
    setCompletedAt(task.id, null);
    setStatusMessage(`Restored ${task.title}.`);
  };

  const completeTask = (task: Task) => {
    pomodoro.detachCompletedTask(task.id);
    setCompletedAt(task.id, new Date().toISOString());
    setStatusMessage(
      `Completed ${task.title}. Kept in Completed for ${COMPLETED_RETENTION_DAYS} days.`,
    );
    // Checking a task off takes it out of the list, so the way back has to be
    // right where it happened.
    toast.success("Task completed", {
      description: task.title,
      action: { label: "Undo", onClick: () => restoreTask(task) },
    });
  };

  const updateTask = (taskId: string, changes: TaskChanges) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...changes,
              // A moved deadline earns a fresh reminder.
              remindedAt:
                task.dueAt === changes.dueAt ? task.remindedAt : null,
            }
          : task,
      ),
    );
    setStatusMessage(`Updated ${changes.title}.`);
  };

  const deleteTask = (task: Task) => {
    pomodoro.detachCompletedTask(task.id);
    setTasks((currentTasks) =>
      currentTasks.filter((currentTask) => currentTask.id !== task.id),
    );
    setStatusMessage(`Deleted ${task.title}.`);
  };

  /** Returns the new tag so the picker that opened the form can tick it. */
  const addTag = ({ name, color }: TagValues): Tag => {
    const tag = createTag(name, color);

    setTags((currentTags) => [...currentTags, tag]);
    setStatusMessage(`Created the tag ${tag.name}.`);
    return tag;
  };

  const updateTag = (tagId: string, values: TagValues) => {
    setTags((currentTags) =>
      currentTags.map((tag) => (tag.id === tagId ? { ...tag, ...values } : tag)),
    );
    setStatusMessage(`Updated the tag ${values.name}.`);
  };

  const deleteTag = (tag: Tag) => {
    setTags((currentTags) => currentTags.filter(({ id }) => id !== tag.id));
    // The tag disappears from the tasks that carried it, the draft task being
    // typed, the filter, and the page that was showing it.
    setTasks((currentTasks) => removeTagFromTasks(currentTasks, tag.id));
    setDraftTagIds((current) => current.filter((id) => id !== tag.id));
    setTagFilter((current) => current.filter((id) => id !== tag.id));
    if (openTagId === tag.id) setOpenTagId(null);
    setStatusMessage(`Deleted the tag ${tag.name}.`);
  };

  /** The list reorders under the reader, so the new order is announced too. */
  const selectDueSort = (sort: DueSort) => {
    setDueSort(sort);
    setStatusMessage(
      `Sorted by due date: ${
        SORT_OPTIONS.find((option) => option.id === sort)?.description ?? sort
      }.`,
    );
  };

  const selectTheme = (next: ThemePreference) => {
    setTheme(next);
    setStatusMessage(THEME_ANNOUNCEMENTS[next]);
  };

  const openTagPage = (tagId: string) => {
    setOpenTagId(tagId);
    setView("tags");
  };

  const filtering = tagFilter.length > 0;
  const pageTitle = openTag ? openTag.name : VIEW_TITLES[view];

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar
        items={navItems}
        activeId={view}
        onSelect={selectView}
        theme={theme}
        onThemeChange={selectTheme}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div
          className={cn(
            "mx-auto w-full px-4 py-8 sm:px-6 sm:py-12",
            view === "pomodoro" ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          <div className="mb-8 sm:mb-10">
            {openTag ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 mb-2 text-muted-foreground"
                onClick={() => setOpenTagId(null)}
              >
                <ChevronLeft aria-hidden="true" />
                All tags
              </Button>
            ) : null}
            <header className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 shrink-0 text-muted-foreground lg:hidden"
                aria-label="Open menu"
                title="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <PanelLeft aria-hidden="true" />
              </Button>
              <h1 className="min-w-0 truncate text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                {pageTitle}
              </h1>
            </header>
          </div>

          {view === "tasks" ? (
            <>
              <form className="grid gap-3" onSubmit={handleAddTask}>
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)]">
                  <div className="grid gap-2">
                    <Label htmlFor={titleId}>Task name</Label>
                    <Input
                      ref={titleInputRef}
                      id={titleId}
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="What needs doing?"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      autoComplete="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus aria-hidden="true" />
                    Add task
                  </Button>
                </div>
                {/* Both are slots the shape of the field above them, muted until
                    filled: they say "optional" without a word of copy. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <DueDatePickerDialog
                    value={dueValue}
                    onValueChange={setDueValue}
                    title={dueValue ? "Change due date" : "Add due date"}
                    trigger={
                      <Button
                        id={dueId}
                        variant="outline"
                        aria-label={
                          dueValue
                            ? `Due ${formatDueDate(dueValue)}. Change due date`
                            : "Add due date"
                        }
                        className={cn(
                          "w-full justify-start overflow-hidden px-3 font-normal",
                          !dueValue && "text-muted-foreground",
                        )}
                      >
                        {dueValue ? (
                          <CalendarClock aria-hidden="true" />
                        ) : (
                          <CalendarPlus aria-hidden="true" />
                        )}
                        <span className="truncate tabular-nums">
                          {dueValue ? formatDueDate(dueValue) : "Add due date"}
                        </span>
                      </Button>
                    }
                  />
                  <TagPickerDialog
                    tags={tags}
                    value={draftTagIds}
                    onValueChange={setDraftTagIds}
                    onCreateTag={addTag}
                    trigger={<TagSelectTrigger tags={draftTags} />}
                  />
                </div>
                {error ? (
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </form>

              <section className="mt-8" aria-labelledby="tasks-heading">
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <TagFilterMenu
                    tags={tags}
                    selected={tagFilter}
                    onSelectedChange={setTagFilter}
                    counts={tagCounts}
                    onManageTags={() => selectView("tags")}
                  />
                  <DueSortMenu value={dueSort} onValueChange={selectDueSort} />
                </div>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2
                    id="tasks-heading"
                    className="text-sm font-semibold tracking-[-0.01em] text-foreground"
                  >
                    Your tasks
                  </h2>
                  {filtering ? (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      Showing {visibleTasks.length} of {activeTasks.length}
                    </p>
                  ) : null}
                </div>
                <TaskList
                  tasks={visibleTasks}
                  tags={tags}
                  tagsById={tagsById}
                  label="Task list"
                  empty={
                    filtering && activeTasks.length > 0 ? (
                      <EmptyPanel
                        icon={SearchX}
                        title="No tasks match"
                        description="None of your open tasks carry the tags you picked."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTagFilter([])}
                          >
                            Clear filter
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyPanel
                        icon={completedTasks.length > 0 ? CircleCheckBig : ListTodo}
                        title={completedTasks.length > 0 ? "All done" : "No tasks yet"}
                        description={
                          completedTasks.length > 0
                            ? "Everything is checked off."
                            : "Add your first task above."
                        }
                      />
                    )
                  }
                  onComplete={completeTask}
                  onSave={(task, changes) => updateTask(task.id, changes)}
                  onDelete={deleteTask}
                  onCreateTag={addTag}
                />
              </section>
            </>
          ) : view === "pomodoro" ? (
            <PomodoroPage
              controller={pomodoro}
              tasks={orderedActiveTasks}
              tagsById={tagsById}
              onCompleteTask={completeTask}
            />
          ) : view === "tags" ? (
            openTag ? (
              <TagDetailPage
                tag={openTag}
                tags={tags}
                tasks={tasks}
                tagsById={tagsById}
                counts={tagCounts}
                onUpdateTag={updateTag}
                onDeleteTag={deleteTag}
                onCreateTag={addTag}
                onCompleteTask={completeTask}
                onSaveTask={(task, changes) => updateTask(task.id, changes)}
                onDeleteTask={deleteTask}
              />
            ) : (
              <TagsPage
                tags={tags}
                counts={tagCounts}
                onOpenTag={openTagPage}
                onCreateTag={addTag}
                onUpdateTag={updateTag}
                onDeleteTag={deleteTag}
              />
            )
          ) : (
            <CompletedTaskList
              tasks={completedTasks}
              tagsById={tagsById}
              onRestore={restoreTask}
              onDelete={deleteTask}
            />
          )}

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>
        </div>
      </main>
      <Toaster theme={resolvedTheme} />
    </div>
  );
}

export default App;
