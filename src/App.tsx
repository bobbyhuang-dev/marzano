import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  CircleCheckBig,
  ListTodo,
  PanelLeft,
  Plus,
  DatabaseBackup,
  SearchX,
  Settings,
  Sparkles,
  Tags as TagsIcon,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import {
  AppSidebar,
  SidebarFooterButton,
  type SidebarItem,
} from "@/components/app-sidebar";
import { BackupDialog } from "@/components/backup-dialog";
import { CalendarPage } from "@/components/calendar-page";
import { CompletedTaskList } from "@/components/completed-task-list";
import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { DueSortMenu, SORT_OPTIONS } from "@/components/due-sort-menu";
import { EmptyPanel } from "@/components/empty-panel";
import { GuideDialog } from "@/components/guide-dialog";
import {
  PomodoroPage,
  PomodoroSettingsDialog,
} from "@/components/pomodoro-page";
import {
  SubtaskPickerDialog,
  SubtaskSelectTrigger,
} from "@/components/subtask-picker-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { TagFilterMenu } from "@/components/tag-filter-menu";
import { type TagValues } from "@/components/tag-form-dialog";
import {
  TagPickerDialog,
  TagSelectTrigger,
} from "@/components/tag-picker-dialog";
import { TagDetailPage, TagsPage } from "@/components/tags-page";
import { type TaskChanges } from "@/components/task-form-dialog";
import { TaskList } from "@/components/task-list";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { useAppearance } from "@/hooks/use-appearance";
import { useCompletedCleanup } from "@/hooks/use-completed-cleanup";
import { useDueReminders } from "@/hooks/use-due-reminders";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { useTheme } from "@/hooks/use-theme";
import { useWhatsNew } from "@/hooks/use-whats-new";
import {
  type AccentId,
  accentLabel,
  type ZoomLevel,
} from "@/lib/appearance";
import {
  applyImport,
  type BackupContents,
  type ImportMode,
  summarizeBackup,
} from "@/lib/backup";
import {
  type CalendarScope,
  loadCalendarScope,
  saveCalendarScope,
} from "@/lib/calendar";
import { saveGuideSeen, shouldOpenGuide } from "@/lib/guide";
import { LATEST_RELEASE } from "@/lib/releases";
import { isPresent, tombstone } from "@/lib/sync";
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
  reorderTasks,
  saveDueSort,
  saveTasks,
  setSubtaskCompleted,
  sortTasksByDue,
  type Subtask,
  type Task,
  touchTask,
} from "@/lib/tasks";
import {
  createTag,
  loadTags,
  resolveTags,
  saveTags,
  tagsById as toTagsById,
  type Tag,
  touchTag,
} from "@/lib/tags";
import { type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ViewId = "tasks" | "calendar" | "pomodoro" | "completed" | "tags";

const THEME_ANNOUNCEMENTS: Record<ThemePreference, string> = {
  system: "Theme now follows your system.",
  light: "Theme set to light.",
  dark: "Theme set to dark.",
};

const VIEW_TITLES: Record<ViewId, string> = {
  tasks: "Tasks",
  calendar: "Calendar",
  pomodoro: "Pomodoro",
  completed: "Completed",
  tags: "Tags",
};

function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [tags, setTags] = useState<Tag[]>(loadTags);
  // Deleting leaves a tombstone behind so the deletion can travel to another
  // copy of the data; everything downstream works from the records still here.
  const presentTasks = tasks.filter(isPresent);
  const presentTags = tags.filter(isPresent);
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

        return touchTask(task, { focusedMs });
      }),
    );
  }, []);
  const pomodoro = usePomodoro(presentTasks, addFocusedTime);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const appearance = useAppearance();
  const [view, setView] = useState<ViewId>("tasks");
  /** The tag whose own page is open, or null while the tag list is showing. */
  const [openTagId, setOpenTagId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [dueSort, setDueSort] = useState<DueSort>(loadDueSort);
  const [calendarScope, setCalendarScope] =
    useState<CalendarScope>(loadCalendarScope);
  const [menuOpen, setMenuOpen] = useState(false);
  // Opened unasked only on a browser that has never been shown it and holds no
  // work yet; every other way in is a button.
  const [guideOpen, setGuideOpen] = useState(() =>
    shouldOpenGuide(tasks.length > 0 || tags.length > 0),
  );
  const whatsNew = useWhatsNew();
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueValue, setDueValue] = useState<string | null>(null);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<Subtask[]>([]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const dueId = useId();
  const errorId = `${titleId}-error`;

  const activeTasks = presentTasks.filter(isActiveTask);
  const completedTasks = presentTasks.filter((task) => !isActiveTask(task));
  const orderedActiveTasks = sortTasksByDue(activeTasks, dueSort);
  const visibleTasks =
    tagFilter.length === 0
      ? orderedActiveTasks
      : orderedActiveTasks.filter((task) => hasAnyTag(task, tagFilter));

  const tagsById = toTagsById(presentTags);
  const tagCounts = countTasksByTag(presentTasks);
  const openTag =
    view === "tags" && openTagId ? (tagsById.get(openTagId) ?? null) : null;
  const draftTags = resolveTags(draftTagIds, tagsById);

  useDueReminders(presentTasks, setTasks);
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

  useEffect(() => {
    saveCalendarScope(calendarScope);
  }, [calendarScope]);

  /** Closing is when the list counts as read, as with the guide. */
  const changeWhatsNewOpen = (open: boolean) => {
    setWhatsNewOpen(open);
    if (!open) whatsNew.markSeen();
  };

  // A toast rather than a dialog: the app is opened daily, and a build that
  // changed is not a reason to stand between someone and their list. The id
  // keeps StrictMode's second mount from raising it twice.
  const announceRelease = whatsNew.announce;
  useEffect(() => {
    if (!announceRelease || LATEST_RELEASE === null) return;

    toast("Marzano updated", {
      id: "whats-new",
      description: LATEST_RELEASE.title,
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      duration: 12_000,
      action: {
        label: "See what's new",
        onClick: () => setWhatsNewOpen(true),
      },
    });
  }, [announceRelease]);

  const navItems: SidebarItem[] = [
    {
      id: "tasks",
      label: VIEW_TITLES.tasks,
      icon: ListTodo,
      count: activeTasks.length,
    },
    {
      // No count: the same open tasks as the row above, laid out by date, so a
      // second tally of them would only be the first one again.
      id: "calendar",
      label: VIEW_TITLES.calendar,
      icon: CalendarDays,
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

  /** Shared by the form at the top of the task page and the calendar's dialog. */
  const addTask = ({
    title: taskTitle,
    dueAt,
    tagIds,
    description,
    subtasks,
  }: TaskChanges) => {
    setTasks((currentTasks) => [
      ...currentTasks,
      createTask(taskTitle, dueAt, tagIds, description, subtasks),
    ]);
    setStatusMessage(`Added ${taskTitle}.`);
  };

  const handleAddTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Enter a task name.");
      titleInputRef.current?.focus();
      return;
    }

    addTask({
      title: trimmedTitle,
      dueAt: dueValue,
      tagIds: draftTagIds,
      description: "",
      subtasks: draftSubtasks,
    });
    setTitle("");
    setDueValue(null);
    setDraftTagIds([]);
    setDraftSubtasks([]);
    setError("");
    titleInputRef.current?.focus();
  };

  const setCompletedAt = (taskId: string, completedAt: string | null) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? touchTask(task, { completedAt }) : task,
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
          ? touchTask(task, {
              ...changes,
              // A moved deadline earns a fresh reminder.
              remindedAt:
                task.dueAt === changes.dueAt ? task.remindedAt : null,
            })
          : task,
      ),
    );
    setStatusMessage(`Updated ${changes.title}.`);
  };

  const completeSubtask = (taskId: string, subtaskId: string, completed: boolean) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? setSubtaskCompleted(task, subtaskId, completed) : task,
      ),
    );
    setStatusMessage(completed ? "Subtask completed." : "Subtask marked incomplete.");
  };

  const deleteTask = (task: Task) => {
    pomodoro.detachCompletedTask(task.id);
    // A tombstone rather than a removal: without it, a browser that still holds
    // the task would put it back the next time a backup was merged.
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id ? tombstone(currentTask) : currentTask,
      ),
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
      currentTags.map((tag) => (tag.id === tagId ? touchTag(tag, values) : tag)),
    );
    setStatusMessage(`Updated the tag ${values.name}.`);
  };

  const deleteTag = (tag: Tag) => {
    setTags((currentTags) =>
      currentTags.map((currentTag) =>
        currentTag.id === tag.id ? tombstone(currentTag) : currentTag,
      ),
    );
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
      SORT_OPTIONS.find((option) => option.id === sort)?.announcement ??
        `Sorted by ${sort}.`,
    );
  };

  /**
   * Moves a task between two positions of the list as it is shown. The list
   * component has already checked the move is allowed under the current sort.
   */
  const moveTask = (from: number, to: number) => {
    const task = visibleTasks[from];
    if (!task || from === to) return;

    const shownIds = visibleTasks.map((shown) => shown.id);
    setTasks((currentTasks) => reorderTasks(currentTasks, shownIds, from, to));
    setStatusMessage(
      `Moved ${task.title} to position ${to + 1} of ${visibleTasks.length}.`,
    );
  };

  /** The grid redraws around the reader, so the new range is announced too. */
  const selectCalendarScope = (scope: CalendarScope) => {
    setCalendarScope(scope);
    setStatusMessage(
      scope === "week"
        ? "Calendar showing one week."
        : "Calendar showing the whole month.",
    );
  };

  const backupContents: BackupContents = {
    tasks,
    tags,
    pomodoro: { settings: pomodoro.settings, history: pomodoro.history },
  };

  const importBackup = (mode: ImportMode, incoming: BackupContents) => {
    const merged = applyImport(mode, backupContents, incoming);

    setTasks(merged.tasks);
    setTags(merged.tags);
    pomodoro.restoreState(merged.pomodoro.settings, merged.pomodoro.history);

    // A replace, or a merge that brought in a deletion, can take away the tag
    // the filter, the draft task or the open page was pointing at.
    const survivingTagIds = new Set(
      merged.tags.filter(isPresent).map((tag) => tag.id),
    );
    setTagFilter((current) => current.filter((id) => survivingTagIds.has(id)));
    setDraftTagIds((current) => current.filter((id) => survivingTagIds.has(id)));
    setOpenTagId((current) =>
      current && survivingTagIds.has(current) ? current : null,
    );

    const summary = summarizeBackup(merged);
    const description = `${summary.openTasks} open ${
      summary.openTasks === 1 ? "task" : "tasks"
    }, ${summary.tags} ${summary.tags === 1 ? "tag" : "tags"}.`;

    setStatusMessage(
      mode === "replace"
        ? `Replaced your data with the backup. ${description}`
        : `Merged the backup into your data. ${description}`,
    );
    toast.success(mode === "replace" ? "Backup restored" : "Backup merged", {
      description,
    });
  };

  const selectTheme = (next: ThemePreference) => {
    setTheme(next);
    setStatusMessage(THEME_ANNOUNCEMENTS[next]);
  };

  const selectAccent = (accent: AccentId) => {
    appearance.setAccent(accent);
    setStatusMessage(`Accent colour set to ${accentLabel(accent)}.`);
  };

  const selectZoom = (zoom: ZoomLevel) => {
    appearance.setZoom(zoom);
    setStatusMessage(`Display size set to ${zoom} percent.`);
  };

  /** Closing it in any way is an answer, so it never opens itself again. */
  const changeGuideOpen = (open: boolean) => {
    setGuideOpen(open);
    if (!open) saveGuideSeen();
  };

  const selectAnnounceUpdates = (announce: boolean) => {
    whatsNew.setMuted(!announce);
    setStatusMessage(
      announce
        ? "Updates will be announced."
        : "Updates will not be announced. What's new stays in the sidebar.",
    );
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
        footerActions={(collapsed) => (
          <>
            <SidebarFooterButton
              icon={BookOpen}
              label="Guide"
              collapsed={collapsed}
              onClick={() => setGuideOpen(true)}
            />
            <SidebarFooterButton
              icon={Sparkles}
              label="What's new"
              collapsed={collapsed}
              fresh={whatsNew.fresh}
              onClick={() => setWhatsNewOpen(true)}
            />
            <BackupDialog
              contents={backupContents}
              onImport={importBackup}
              trigger={
                <SidebarFooterButton
                  icon={DatabaseBackup}
                  label="Backup"
                  collapsed={collapsed}
                />
              }
            />
            <SettingsDialog
              theme={theme}
              onThemeChange={selectTheme}
              accent={appearance.accent}
              onAccentChange={selectAccent}
              zoom={appearance.zoom}
              onZoomChange={selectZoom}
              announceUpdates={!whatsNew.muted}
              onAnnounceUpdatesChange={selectAnnounceUpdates}
              trigger={
                <SidebarFooterButton
                  icon={Settings}
                  label="Settings"
                  collapsed={collapsed}
                />
              }
            />
          </>
        )}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
      />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div
          className={cn(
            "mx-auto w-full px-4 py-8 transition-[max-width] duration-base ease-out-cubic sm:px-6 sm:py-12",
            // Seven columns of days need more room than a single column of task
            // rows, so the calendar is the one page that reads wider.
            view === "calendar" ? "max-w-5xl" : "max-w-3xl",
          )}
        >
          {/* Keyed on the view, so each one is a fresh mount that rises in;
              no exit, so nothing waits on the one before. The live region
              stays outside it, or every change would re-announce itself. */}
          <div key={`${view}/${openTagId ?? ""}`} className="animate-view-in">
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
                <h1 className="min-w-0 flex-1 truncate text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
                  {pageTitle}
                </h1>
                {/* The only page with a setting of its own keeps it on the title
                    row, rather than floating a control above the page. */}
                {view === "pomodoro" ? (
                  <PomodoroSettingsDialog controller={pomodoro} />
                ) : null}
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
                  {/* All three are slots the shape of the field above them, muted
                      until filled: they say "optional" without a word of copy. */}
                  <div className="grid gap-3 sm:grid-cols-3">
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
                      tags={presentTags}
                      value={draftTagIds}
                      onValueChange={setDraftTagIds}
                      onCreateTag={addTag}
                      trigger={<TagSelectTrigger tags={draftTags} />}
                    />
                    <SubtaskPickerDialog
                      value={draftSubtasks}
                      onValueChange={setDraftSubtasks}
                      trigger={<SubtaskSelectTrigger subtasks={draftSubtasks} />}
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
                      tags={presentTags}
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
                    tags={presentTags}
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
                          action={
                            // Only on a list that has never held anything: past
                            // the first task, an emptied list is an achievement
                            // rather than a place to ask what the app is.
                            completedTasks.length > 0 ? undefined : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setGuideOpen(true)}
                              >
                                <BookOpen aria-hidden="true" />
                                How Marzano works
                              </Button>
                            )
                          }
                        />
                      )
                    }
                    onComplete={completeTask}
                    onSubtaskComplete={(task, id, completed) =>
                      completeSubtask(task.id, id, completed)
                    }
                    onSave={(task, changes) => updateTask(task.id, changes)}
                    onDelete={deleteTask}
                    onCreateTag={addTag}
                    reorder={{ sort: dueSort, onMove: moveTask }}
                  />
                </section>
              </>
            ) : view === "calendar" ? (
              <CalendarPage
                tasks={activeTasks}
                tags={presentTags}
                tagsById={tagsById}
                scope={calendarScope}
                onScopeChange={selectCalendarScope}
                onAddTask={addTask}
                onCompleteTask={completeTask}
                onSaveTask={(task, changes) => updateTask(task.id, changes)}
                onSubtaskComplete={(task, id, completed) =>
                  completeSubtask(task.id, id, completed)
                }
                onDeleteTask={deleteTask}
                onCreateTag={addTag}
              />
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
                  tags={presentTags}
                  tasks={presentTasks}
                  tagsById={tagsById}
                  counts={tagCounts}
                  onUpdateTag={updateTag}
                  onDeleteTag={deleteTag}
                  onCreateTag={addTag}
                  onCompleteTask={completeTask}
                  onSaveTask={(task, changes) => updateTask(task.id, changes)}
                  onSubtaskComplete={(task, id, completed) =>
                    completeSubtask(task.id, id, completed)
                  }
                  onDeleteTask={deleteTask}
                />
              ) : (
                <TagsPage
                  tags={presentTags}
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
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>
        </div>
      </main>
      <GuideDialog open={guideOpen} onOpenChange={changeGuideOpen} />
      <WhatsNewDialog
        open={whatsNewOpen}
        onOpenChange={changeWhatsNewOpen}
        unseen={whatsNew.unseen}
        muted={whatsNew.muted}
        onMutedChange={(muted) => selectAnnounceUpdates(!muted)}
      />
      <Toaster theme={resolvedTheme} />
    </div>
  );
}

export default App;
