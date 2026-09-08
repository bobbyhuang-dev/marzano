import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
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
  FolderOpen,
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
import { StorageUpgradeNotice } from "@/components/storage-upgrade-notice";
import { dismissStorageUpgrade, shouldShowStorageUpgrade, LEGACY_DATA_KEYS } from "@/lib/storage-upgrade";
import { LocalDataDialog } from "@/components/local-data-dialog";
import { downloadCopy, openLocalData, storageLabel, supportsLocalFolders, type LocalDataStore } from "@/lib/local-data";
import { type DataContents } from "@/lib/data-file";
import { CalendarPage } from "@/components/calendar-page";
import { CompletedTaskList } from "@/components/completed-task-list";
import {
  DescriptionPickerDialog,
  DescriptionSelectTrigger,
} from "@/components/description-picker-dialog";
import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { DuePhraseInput } from "@/components/due-phrase-input";
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
import { TagMentionMenu } from "@/components/tag-mention-menu";
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
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { useAppearance } from "@/hooks/use-appearance";
import { useCompletedCleanup } from "@/hooks/use-completed-cleanup";
import { useDuePhrase } from "@/hooks/use-due-phrase";
import { useDueReminders } from "@/hooks/use-due-reminders";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { useTagMention } from "@/hooks/use-tag-mention";
import { useTheme } from "@/hooks/use-theme";
import { useWhatsNew } from "@/hooks/use-whats-new";
import {
  type AccentId,
  accentLabel,
  type ZoomLevel,
} from "@/lib/appearance";
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
  removeTagFromTasks,
  reorderTasks,
  saveDueSort,
  setSubtaskCompleted,
  sortTasksByDue,
  type Subtask,
  type Task,
  touchTask,
} from "@/lib/tasks";
import {
  createTag,
  resolveTags,
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

function AppContent({ store }: { store: LocalDataStore }) {
  const [tasks, setTasks] = useState<Task[]>(() => store.contents.tasks);
  const [tags, setTags] = useState<Tag[]>(() => store.contents.tags);
  const storage = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [dataOpen, setDataOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(() => shouldShowStorageUpgrade(storage.upgradeRequired, storage.upgradeCompleted));
  const dismissUpgrade = () => { dismissStorageUpgrade(); setUpgradeOpen(false); };
  const startUpgrade = () => { dismissUpgrade(); setDataOpen(true); };
  const saveUpgradeCopy = () => { dismissUpgrade(); downloadCopy(store.contents); };
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
  const pomodoro = usePomodoro(presentTasks, addFocusedTime, store.contents.pomodoro);
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
    !storage.upgradeRequired && shouldOpenGuide(tasks.length > 0 || tags.length > 0),
  );
  const whatsNew = useWhatsNew();
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  // The name and the due date are one field: a date typed into the name
  // ("Call mum tmr") is the due date until it is deleted or a date is picked.
  const draft = useDuePhrase();
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<Subtask[]>([]);
  const [draftDescription, setDraftDescription] = useState("");
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
  // A "#" in the name opens the tags; the one picked joins the chip below and
  // its words leave the name, so a tag is typed without leaving the field.
  const mention = useTagMention({
    tags: presentTags,
    value: draft.title,
    onValueChange: draft.setTitle,
    onPick: (tag) => {
      setDraftTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
      setStatusMessage(`Tagged ${tag.name}.`);
    },
    inputRef: titleInputRef,
  });

  useDueReminders(presentTasks, setTasks);
  useCompletedCleanup(setTasks);

  useEffect(() => {
    store.update({ tasks, tags, pomodoro: { settings: pomodoro.settings, history: pomodoro.history } });
  }, [store, tasks, tags, pomodoro.settings, pomodoro.history]);

  useEffect(() => {
    const check = () => { if (!document.hidden) void store.checkForChanges(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (store.hasUnsavedChanges) { event.preventDefault(); event.returnValue = ""; }
    };
    const legacyChanged = (event: StorageEvent) => {
      if (event.key === null || LEGACY_DATA_KEYS.includes(event.key)) store.checkLegacyChanges();
    };
    window.addEventListener("storage", legacyChanged);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("storage", legacyChanged);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [store]);

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
    if (!announceRelease || LATEST_RELEASE === null || (storage.upgradeRequired && !storage.upgradeCompleted)) return;

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
  }, [announceRelease, storage.upgradeRequired, storage.upgradeCompleted]);

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

    if (!draft.cleanTitle) {
      setError("Enter a task name.");
      titleInputRef.current?.focus();
      return;
    }

    addTask({
      title: draft.cleanTitle,
      dueAt: draft.dueAt,
      tagIds: draftTagIds,
      description: draftDescription,
      subtasks: draftSubtasks,
    });
    draft.reset();
    setDraftTagIds([]);
    setDraftSubtasks([]);
    setDraftDescription("");
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

  const applyData = (incoming: DataContents) => {
    setTasks(incoming.tasks);
    setTags(incoming.tags);
    pomodoro.restoreState(incoming.pomodoro.settings, incoming.pomodoro.history);
    const surviving = new Set(incoming.tags.filter(isPresent).map((tag) => tag.id));
    setTagFilter((current) => current.filter((id) => surviving.has(id)));
    setDraftTagIds((current) => current.filter((id) => surviving.has(id)));
    setOpenTagId((current) => current && surviving.has(current) ? current : null);
    setStatusMessage("Opened local data.");
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
            <SidebarFooterButton
              icon={FolderOpen}
              label="Local data"
              collapsed={collapsed}
              onClick={() => setDataOpen(true)}
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

      <StorageUpgradeNotice open={upgradeOpen && !storage.upgradeCompleted} supported={supportsLocalFolders()} onDismiss={dismissUpgrade} onStart={startUpgrade} onSaveCopy={saveUpgradeCopy} />
      <LocalDataDialog open={dataOpen} onOpenChange={setDataOpen} store={store} status={storage} onApply={applyData} />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div
          className={cn(
            "mx-auto w-full px-4 py-6 transition-[max-width] duration-base ease-out-cubic sm:px-6 sm:py-8",
            // Seven columns of days need more room than a single column of task
            // rows, so the calendar is the one page that reads wider. Both take
            // one more step on a wide screen: the root size already grows with
            // the viewport (index.css), and this keeps the column's share of
            // it from shrinking, without stretching a task row past the width
            // it can be read at in one glance.
            view === "calendar"
              ? "max-w-5xl 2xl:max-w-6xl"
              : "max-w-3xl 2xl:max-w-4xl",
          )}
        >
          {/* The title row is the one piece of chrome every page shares, so
              it sits outside the keyed view below: the storage status at its
              end is a live region, and remounting it with each view would
              read the same three words aloud on every switch. */}
          <div className="mb-5 sm:mb-6">
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
              {/* Keyed like the page body, so the name rises in with it. */}
              <div
                key={`${view}/${openTagId ?? ""}`}
                className="flex min-w-0 flex-1 items-center gap-2 animate-view-in sm:gap-3"
              >
                {openTag ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground lg:-ml-2"
                    aria-label="Back to all tags"
                    title="All tags"
                    onClick={() => setOpenTagId(null)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                ) : null}
                <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
                  {pageTitle}
                </h1>
                {/* The only page with a setting of its own keeps it on the
                    title row, rather than floating a control above the page. */}
                {view === "pomodoro" ? (
                  <PomodoroSettingsDialog controller={pomodoro} />
                ) : null}
              </div>
              {/* Where the tasks are, in three words, on every page: the one
                  status the app cannot afford to hide, and the way into the
                  dialog that says the rest. */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "shrink-0 text-muted-foreground",
                  ["error", "access", "conflict"].includes(storage.phase) && "text-destructive hover:text-destructive",
                )}
                onClick={() => setDataOpen(true)}
              >
                <FolderOpen aria-hidden="true" />
                <span role="status" aria-live="polite">{storageLabel(storage)}</span>
              </Button>
            </header>
            {storage.cacheWarning && <p role="alert" className="mt-1 text-xs text-destructive">{storage.cacheWarning}</p>}
          </div>
          {/* Keyed on the view, so each one is a fresh mount that rises in;
              no exit, so nothing waits on the one before. The live regions
              stay outside it, or every change would re-announce itself. */}
          <div key={`${view}/${openTagId ?? ""}`} className="animate-view-in">
            {view === "tasks" ? (
              <>
                <form className="grid gap-2" onSubmit={handleAddTask}>
                  {/* One line: the field and the button that sends it. The
                      name is the whole form on a good day, so nothing else
                      sits between the reader and typing it. */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={titleId} className="sr-only">
                        Task name
                      </Label>
                      <DuePhraseInput
                        {...mention.inputProps}
                        ref={titleInputRef}
                        id={titleId}
                        value={draft.title}
                        phrase={draft.phrase}
                        mention={mention.mention}
                        onChange={(event) => {
                          mention.inputProps.onChange(event);
                          if (error) setError("");
                        }}
                        placeholder={
                          presentTags.length > 0
                            ? "What needs doing? Type # to add a tag"
                            : "What needs doing?"
                        }
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        autoComplete="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore
                      >
                        <TagMentionMenu field={mention} />
                      </DuePhraseInput>
                    </div>
                    <Button type="submit" className="shrink-0">
                      <Plus aria-hidden="true" />
                      Add<span className="sr-only"> task</span>
                    </Button>
                  </div>
                  {/* The optional parts are chips under the field, muted until
                      filled: small enough to ignore, and the list starts a few
                      lines down rather than below a wall of empty fields. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DueDatePickerDialog
                      value={draft.dueAt}
                      onValueChange={draft.setDueAt}
                      title={draft.dueAt ? "Change due date" : "Add due date"}
                      trigger={
                        <Button
                          id={dueId}
                          variant="outline"
                          size="sm"
                          aria-label={
                            draft.dueAt
                              ? `Due ${formatDueDate(draft.dueAt)}. Change due date`
                              : "Add due date"
                          }
                          className={cn(
                            "max-w-full rounded-full font-normal",
                            // Set, the chip takes the tint of the boxed words
                            // in the name, so the two read as one date.
                            draft.dueAt
                              ? "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15"
                              : "text-muted-foreground",
                          )}
                        >
                          {draft.dueAt ? (
                            <CalendarClock aria-hidden="true" />
                          ) : (
                            <CalendarPlus aria-hidden="true" />
                          )}
                          <span className="truncate tabular-nums">
                            {draft.dueAt ? formatDueDate(draft.dueAt) : "Due date"}
                          </span>
                        </Button>
                      }
                    />
                    <TagPickerDialog
                      tags={presentTags}
                      value={draftTagIds}
                      onValueChange={setDraftTagIds}
                      onCreateTag={addTag}
                      trigger={<TagSelectTrigger tags={draftTags} variant="chip" />}
                    />
                    <SubtaskPickerDialog
                      value={draftSubtasks}
                      onValueChange={setDraftSubtasks}
                      trigger={<SubtaskSelectTrigger subtasks={draftSubtasks} variant="chip" />}
                    />
                    <DescriptionPickerDialog
                      value={draftDescription}
                      onValueChange={setDraftDescription}
                      trigger={
                        <DescriptionSelectTrigger
                          description={draftDescription}
                          variant="chip"
                        />
                      }
                    />
                  </div>
                  {error ? (
                    <p id={errorId} role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                </form>

                <section className="mt-6" aria-labelledby="tasks-heading">
                  {/* The heading and the two controls that shape the list share
                      one line, so the list is one row of chrome away from the
                      composer rather than three. */}
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 items-baseline gap-3">
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TagFilterMenu
                        tags={presentTags}
                        selected={tagFilter}
                        onSelectedChange={setTagFilter}
                        counts={tagCounts}
                        onManageTags={() => selectView("tags")}
                      />
                      <DueSortMenu value={dueSort} onValueChange={selectDueSort} />
                    </div>
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

function App() {
  const [store, setStore] = useState<LocalDataStore | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void openLocalData().then((next) => { if (active) setStore(next); }, (cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not open local storage.");
    });
    return () => { active = false; };
  }, []);
  if (store) return <AppContent store={store} />;
  return <main className="mx-auto grid min-h-dvh max-w-md content-center gap-4 p-6">
    <h1 className="text-xl font-semibold">Marzano</h1>
    <p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error || "Opening your local data…"}</p>
    {error && <Button onClick={() => window.location.reload()}>Reload</Button>}
  </main>;
}

export default App;
