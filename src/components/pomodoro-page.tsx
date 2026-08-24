import { useId, useRef, useState, type ReactNode } from "react";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import {
  CalendarClock,
  CalendarOff,
  Check,
  ListTodo,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Trash2,
} from "lucide-react";

import { EmptyPanel } from "@/components/empty-panel";
import { TagChip, TagChipList } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberCombobox } from "@/components/ui/number-combobox";
import { Switch } from "@/components/ui/switch";
import type { PomodoroController } from "@/hooks/use-pomodoro";
import {
  formatFocusDuration,
  type PomodoroPhase,
  type PomodoroSessionRecord,
  type PomodoroStatus,
} from "@/lib/pomodoro";
import { formatDueDate, isActiveTask, type Task } from "@/lib/tasks";
import { resolveTags, type Tag } from "@/lib/tags";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

interface PomodoroPageProps {
  controller: PomodoroController;
  tasks: Task[];
  tagsById: Map<string, Tag>;
  onCompleteTask: (task: Task) => void;
}

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

const STATUS_LABELS: Record<PomodoroStatus, string> = {
  idle: "not started",
  running: "running",
  paused: "paused",
};

const FOCUS_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90];
const SHORT_BREAK_OPTIONS = [3, 5, 10, 15, 20];
const LONG_BREAK_OPTIONS = [10, 15, 20, 25, 30, 45];
const INTERVAL_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

/** How many finished sessions the activity list shows before it stops. */
const RECENT_SESSION_COUNT = 5;

const DIAL_RADIUS = 54;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(totalMinutes)}:${pad(seconds)}`;
}

/** The page's one heading shape: a title, and at most one action beside it. */
function SectionHeading({
  id,
  title,
  action,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2
        id={id}
        className="text-sm font-semibold tracking-[-0.01em] text-foreground"
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * The countdown, drawn as a ring that fills as the round runs. The arc is the
 * only thing on the page that carries colour weight, so the time inside it can
 * stay plain text on the page background.
 */
function TimerDial({
  remainingMs,
  plannedDurationMs,
  phase,
  status,
  hint,
}: {
  remainingMs: number;
  plannedDurationMs: number;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  hint: string;
}) {
  const progress =
    plannedDurationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / plannedDurationMs))
      : 0;
  const time = formatCountdown(remainingMs);

  return (
    <div
      role="timer"
      aria-live="off"
      aria-atomic="true"
      aria-label={`${PHASE_LABELS[phase]}, ${STATUS_LABELS[status]}, ${time} remaining`}
      className="relative flex size-56 shrink-0 items-center justify-center sm:size-64"
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" className="size-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={DIAL_RADIUS}
          fill="none"
          strokeWidth="5"
          className="stroke-border"
        />
        {/* A zero-length dash with a round cap still paints a dot, so the arc
            only exists once the round has actually moved. */}
        {progress > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={DIAL_RADIUS}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={DIAL_CIRCUMFERENCE}
            strokeDashoffset={DIAL_CIRCUMFERENCE * (1 - progress)}
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-linear",
              phase === "focus" ? "stroke-primary" : "stroke-muted-foreground",
              status === "paused" && "opacity-45",
            )}
          />
        ) : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {PHASE_LABELS[phase]}
        </span>
        <span
          className={cn(
            "font-semibold leading-none tracking-[-0.055em] tabular-nums text-foreground",
            time.length > 5 ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl",
          )}
        >
          {time}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function TaskPickerDialog({
  open,
  onOpenChange,
  tasks,
  selectedTaskId,
  tagsById,
  onSelect,
  running,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  selectedTaskId: string | null;
  tagsById: Map<string, Tag>;
  onSelect: (taskId: string) => void;
  running: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-4 pr-14 pt-6">
          <DialogTitle>Choose a focus task</DialogTitle>
          <DialogDescription>
            {running ? "The timer keeps running." : "Pick one for this round."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-3 pb-3">
          {tasks.length === 0 ? (
            <div className="px-3 pb-3">
              <EmptyPanel
                icon={ListTodo}
                title="No open tasks"
                description="Add a task on the Tasks page, then come back to focus."
              />
            </div>
          ) : (
            <div role="group" aria-label="Open tasks" className="grid gap-0.5">
              {tasks.map((task) => {
                const selected = task.id === selectedTaskId;

                return (
                  <button
                    key={task.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      onSelect(task.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex min-h-16 w-full items-start gap-3 rounded-md px-3 py-3 text-left ring-offset-background transition-colors duration-150 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected && "bg-secondary hover:bg-secondary",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {selected ? <Check strokeWidth={3} className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium leading-6 text-foreground">
                        {task.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                          {task.dueAt ? formatDueDate(task.dueAt) : "No due date"}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {resolveTags(task.tagIds, tagsById).map((tag) => (
                            <TagChip key={tag.id} tag={tag} />
                          ))}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const descriptionId = useId();

  return (
    <div
      className={cn(
        "flex items-center gap-4 py-3.5",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p
          id={descriptionId}
          className="mt-0.5 text-sm leading-5 text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        aria-describedby={descriptionId}
      />
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-sm font-semibold tracking-[-0.01em] text-foreground"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function DurationField({
  id,
  label,
  value,
  options,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: number[];
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NumberCombobox
        id={id}
        value={value}
        options={options}
        min={1}
        max={max}
        formatValue={(minutes) => `${minutes} min`}
        onValueChange={onChange}
        aria-label={`${label} in minutes`}
      />
    </div>
  );
}

/** Lives beside the page title, the way the sidebar's own controls do. */
function PomodoroSettingsDialog({
  controller,
}: {
  controller: PomodoroController;
}) {
  const { settings, updateSettings, requestNotificationPermission } = controller;
  const focusId = useId();
  const shortBreakId = useId();
  const longBreakId = useId();
  const intervalId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );

  const requestPermission = async () => {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    return nextPermission;
  };

  const changeDesktopAlerts = async (desktopAlerts: boolean) => {
    if (!desktopAlerts) {
      updateSettings({ desktopAlerts: false });
      return;
    }

    const nextPermission =
      permission === "granted" ? permission : await requestPermission();
    updateSettings({ desktopAlerts: nextPermission === "granted" });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          aria-label="Pomodoro settings"
          title="Settings"
        >
          <Settings2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pr-14 pt-6">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="focus:outline-none"
          >
            Pomodoro settings
          </DialogTitle>
          <DialogDescription>
            Changes apply from the next round and save as you make them.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <SettingsSection title="Durations">
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <DurationField
                id={focusId}
                label="Focus"
                value={settings.focusMinutes}
                options={FOCUS_OPTIONS}
                max={120}
                onChange={(focusMinutes) => updateSettings({ focusMinutes })}
              />
              <DurationField
                id={shortBreakId}
                label="Short break"
                value={settings.shortBreakMinutes}
                options={SHORT_BREAK_OPTIONS}
                max={120}
                onChange={(shortBreakMinutes) =>
                  updateSettings({ shortBreakMinutes })
                }
              />
              <DurationField
                id={longBreakId}
                label="Long break"
                value={settings.longBreakMinutes}
                options={LONG_BREAK_OPTIONS}
                max={120}
                onChange={(longBreakMinutes) =>
                  updateSettings({ longBreakMinutes })
                }
              />
              <div className="grid gap-2">
                <Label htmlFor={intervalId}>Long break after</Label>
                <NumberCombobox
                  id={intervalId}
                  value={settings.longBreakInterval}
                  options={INTERVAL_OPTIONS}
                  min={2}
                  max={12}
                  formatValue={(rounds) => `${rounds} rounds`}
                  onValueChange={(longBreakInterval) =>
                    updateSettings({ longBreakInterval })
                  }
                  aria-label="Focus rounds before a long break"
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Session flow">
            <div className="divide-y divide-border">
              <SettingToggle
                title="Auto-start breaks"
                description="Begin the break as soon as focus ends."
                checked={settings.autoStartBreaks}
                onCheckedChange={(autoStartBreaks) =>
                  updateSettings({ autoStartBreaks })
                }
              />
              <SettingToggle
                title="Auto-start focus"
                description="Begin the next round as soon as the break ends."
                checked={settings.autoStartFocus}
                onCheckedChange={(autoStartFocus) =>
                  updateSettings({ autoStartFocus })
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <div className="divide-y divide-border">
              <SettingToggle
                title="Round notifications"
                description="A chime and an in-app alert when a round finishes."
                checked={settings.notifications}
                onCheckedChange={(notifications) =>
                  updateSettings({ notifications })
                }
              />
              <SettingToggle
                title="Desktop alerts"
                description={
                  !settings.notifications
                    ? "Turn on round notifications to use desktop alerts."
                    : permission === "denied"
                      ? "Blocked in your browser settings. In-app alerts still work."
                      : permission === "unsupported"
                        ? "Not supported here. In-app alerts still work."
                        : permission === "default"
                          ? "Turn on to allow system alerts for finished rounds."
                          : settings.desktopAlerts
                            ? "A system alert waits for you when a round finishes."
                            : "System alerts are turned off."
                }
                checked={settings.desktopAlerts && permission === "granted"}
                onCheckedChange={changeDesktopAlerts}
                disabled={
                  !settings.notifications ||
                  permission === "denied" ||
                  permission === "unsupported"
                }
              />
            </div>
          </SettingsSection>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 pb-6 pt-4 sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Saved automatically</p>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DayStat {
  date: Date;
  durationMs: number;
}

function currentFocusDuration(controller: PomodoroController): number {
  const { timer, now } = controller;
  if (timer.phase !== "focus") return 0;

  const runningMs =
    timer.status === "running" && timer.activeStartedAt !== null
      ? Math.max(
          0,
          Math.min(
            timer.plannedDurationMs - timer.accumulatedMs,
            now - timer.activeStartedAt,
          ),
        )
      : 0;

  return timer.accumulatedMs + runningMs;
}

function sessionTaskLabel(session: PomodoroSessionRecord): string {
  const titles = session.allocations.map(({ taskTitle }) => taskTitle);
  if (titles.length === 0) return "Focus session";
  if (titles.length <= 2) return titles.join(" · ");
  return `${titles.slice(0, 2).join(" · ")} +${titles.length - 2}`;
}

function ClearHistoryDialog({ onClear }: { onClear: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 text-muted-foreground"
          aria-label="Clear Pomodoro history"
        >
          <Trash2 aria-hidden="true" />
          Clear
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Pomodoro history?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes session statistics from this device. Focus time already
            attached to your tasks stays intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onClear}>Clear history</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    // A long total ("2 hr 35 min") wraps rather than truncating, so the labels
    // are pushed to the bottom of the row to stay level with each other.
    <div className="flex h-full min-w-0 flex-col">
      <p className="text-xl font-semibold leading-tight tracking-[-0.03em] tabular-nums text-foreground sm:text-2xl">
        {value}
      </p>
      <p className="mt-auto pt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Today's totals, the week behind them, and the last few finished rounds. */
function PomodoroActivity({ controller }: { controller: PomodoroController }) {
  const { history, now, clearHistory } = controller;
  const today = new Date(now);
  const todayStart = startOfDay(today).getTime();
  const liveDurationMs = currentFocusDuration(controller);
  const dayRange = Array.from({ length: 7 }, (_, index) =>
    startOfDay(subDays(new Date(todayStart), 6 - index)),
  );
  const days: DayStat[] = dayRange.map((date, index) => ({
    date,
    durationMs:
      history
        .filter(({ endedAt }) => isSameDay(new Date(endedAt), date))
        .reduce((sum, session) => sum + session.durationMs, 0) +
      (index === dayRange.length - 1 ? liveDurationMs : 0),
  }));
  const todayHistory = history.filter(
    ({ endedAt }) => endedAt >= todayStart && isSameDay(new Date(endedAt), today),
  );
  const todayFocusMs =
    todayHistory.reduce((sum, session) => sum + session.durationMs, 0) +
    liveDurationMs;
  const todaySessions = todayHistory.filter(({ completed }) => completed).length;
  const todayTaskIds = new Set(
    todayHistory.flatMap(({ allocations }) =>
      allocations.map(({ taskId }) => taskId),
    ),
  );
  controller.timer.allocations.forEach(({ taskId, durationMs }) => {
    if (durationMs > 0) todayTaskIds.add(taskId);
  });
  if (
    controller.timer.phase === "focus" &&
    controller.timer.status === "running" &&
    controller.timer.activeStartedAt !== null &&
    controller.now > controller.timer.activeStartedAt &&
    controller.selectedTask
  ) {
    todayTaskIds.add(controller.selectedTask.id);
  }
  const weeklyTotalMs = days.reduce((sum, day) => sum + day.durationMs, 0);
  const maxDayMs = Math.max(...days.map(({ durationMs }) => durationMs), 1);

  return (
    <>
      <section className="mt-10" aria-labelledby="today-heading">
        <SectionHeading id="today-heading" title="Today" />
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <Metric value={formatFocusDuration(todayFocusMs)} label="Focused" />
          <Metric value={String(todaySessions)} label="Rounds" />
          <Metric value={String(todayTaskIds.size)} label="Tasks" />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="week-heading">
        <SectionHeading
          id="week-heading"
          title="Last 7 days"
          action={
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatFocusDuration(weeklyTotalMs)}
            </span>
          }
        />
        <div
          role="img"
          aria-label={`Seven day focus chart. ${days
            .map(
              ({ date, durationMs }) =>
                `${format(date, "EEEE")}: ${formatFocusDuration(durationMs)}`,
            )
            .join(". ")}`}
          className="grid h-28 grid-cols-7 gap-2"
        >
          {days.map(({ date, durationMs }, index) => {
            const isToday = index === days.length - 1;
            // A short round still has to be visible, so anything above zero
            // keeps a floor of a few pixels.
            const height =
              durationMs === 0 ? 0 : Math.max(6, (durationMs / maxDayMs) * 100);

            return (
              <div
                key={date.toISOString()}
                title={`${format(date, "EEE")} · ${formatFocusDuration(durationMs)}`}
                className="flex min-w-0 flex-col items-center gap-2"
              >
                <div className="flex w-full min-h-0 flex-1 items-end justify-center">
                  <div className="flex h-full w-2 items-end rounded-full bg-muted">
                    <div
                      className={cn(
                        "w-full rounded-full transition-[height] duration-300 ease-out",
                        isToday ? "bg-primary" : "bg-foreground/25",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                </div>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    isToday && "font-medium text-foreground",
                  )}
                >
                  {format(date, "EEE")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {history.length > 0 ? (
        <section className="mt-10" aria-labelledby="recent-heading">
          <SectionHeading
            id="recent-heading"
            title="Recent rounds"
            action={<ClearHistoryDialog onClear={clearHistory} />}
          />
          <ul
            className="divide-y divide-border"
            aria-label="Recent focus sessions"
          >
            {history.slice(0, RECENT_SESSION_COUNT).map((session) => (
              <li key={session.id} className="flex items-baseline gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {sessionTaskLabel(session)}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {format(new Date(session.endedAt), "MMM d · h:mm a")}
                    </span>
                    {session.completed ? null : (
                      <>
                        <span aria-hidden="true" className="px-1.5">
                          ·
                        </span>
                        stopped early
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {formatFocusDuration(session.durationMs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PomodoroPage({
  controller,
  tasks,
  tagsById,
  onCompleteTask,
}: PomodoroPageProps) {
  const { timer, settings, selectedTask, remainingMs } = controller;
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const activeTasks = tasks.filter(isActiveTask);
  const isFocus = timer.phase === "focus";
  const running = timer.status === "running";
  const hasRoundProgress =
    running || timer.status === "paused" || timer.accumulatedMs > 0;
  const openSelectedSliceMs =
    isFocus && running && timer.activeStartedAt !== null && selectedTask
      ? Math.max(
          0,
          Math.min(
            timer.plannedDurationMs - timer.accumulatedMs,
            controller.now - timer.activeStartedAt,
          ),
        )
      : 0;
  const selectedFocusedMs = (selectedTask?.focusedMs ?? 0) + openSelectedSliceMs;
  const progressRound =
    (timer.completedFocusCount % settings.longBreakInterval) + 1;
  const roundHint = isFocus
    ? `Round ${progressRound} of ${settings.longBreakInterval}`
    : "Focus is up next";
  const hint =
    timer.status === "paused" ? `Paused · ${roundHint}` : roundHint;
  const primaryAction = running
    ? "Pause"
    : hasRoundProgress
      ? "Resume"
      : "Start";
  const canStart = !isFocus || selectedTask !== null;

  const completeCurrentTask = () => {
    if (!selectedTask) return;
    const hasAnotherTask = activeTasks.some(({ id }) => id !== selectedTask.id);
    onCompleteTask(selectedTask);
    if (hasAnotherTask) setTaskPickerOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-center">
        <TimerDial
          remainingMs={remainingMs}
          plannedDurationMs={timer.plannedDurationMs}
          phase={timer.phase}
          status={timer.status}
          hint={hint}
        />

        <div className="mt-8 flex items-center gap-1.5">
          <Button
            size="lg"
            className="min-w-40"
            aria-label={`${primaryAction} ${PHASE_LABELS[timer.phase].toLowerCase()}`}
            disabled={!running && !canStart}
            onClick={running ? controller.pause : controller.start}
          >
            {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {primaryAction}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label={`Restart ${PHASE_LABELS[timer.phase].toLowerCase()}`}
            title="Restart round"
            disabled={!hasRoundProgress}
            onClick={controller.restart}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label={isFocus ? "End focus" : "Skip break"}
            title={isFocus ? "End focus" : "Skip break"}
            disabled={isFocus && !hasRoundProgress}
            onClick={controller.skip}
          >
            <SkipForward aria-hidden="true" />
          </Button>
        </div>

        {isFocus && !selectedTask ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pick a focus task below to start the round.
          </p>
        ) : null}
      </div>

      <section className="mt-10" aria-labelledby="focus-task-heading">
        <SectionHeading
          id="focus-task-heading"
          title={isFocus ? "Focus task" : "Next task"}
          action={
            selectedTask ? (
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 text-muted-foreground"
                onClick={() => setTaskPickerOpen(true)}
              >
                Change
              </Button>
            ) : null
          }
        />

        {selectedTask ? (
          // The same row the task pages use, so checking it off here means what
          // it means everywhere else.
          <div className="flex items-start gap-2 sm:gap-3">
            <Checkbox
              className="-ml-3 -mt-2.5"
              checked={false}
              onCheckedChange={completeCurrentTask}
              aria-label={`Mark ${selectedTask.title} as complete`}
              title="Complete task"
            />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium leading-6 text-foreground">
                {selectedTask.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {selectedTask.dueAt ? (
                    <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
                  ) : (
                    <CalendarOff aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className="break-words tabular-nums">
                    {selectedTask.dueAt
                      ? formatDueDate(selectedTask.dueAt)
                      : "No due date"}
                  </span>
                </p>
                {selectedFocusedMs > 0 ? (
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatFocusDuration(selectedFocusedMs)} focused
                  </p>
                ) : null}
                <TagChipList tags={resolveTags(selectedTask.tagIds, tagsById)} />
              </div>
            </div>
          </div>
        ) : (
          <EmptyPanel
            icon={ListTodo}
            title="No task chosen"
            description={
              activeTasks.length === 0
                ? "Add a task on the Tasks page, then come back to focus."
                : "Focus time is credited to the task you pick."
            }
            action={
              <Button
                disabled={activeTasks.length === 0}
                onClick={() => setTaskPickerOpen(true)}
              >
                Choose a task
              </Button>
            }
          />
        )}
      </section>

      <TaskPickerDialog
        open={taskPickerOpen}
        onOpenChange={setTaskPickerOpen}
        tasks={activeTasks}
        selectedTaskId={selectedTask?.id ?? null}
        tagsById={tagsById}
        onSelect={controller.selectTask}
        running={running && isFocus}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {PHASE_LABELS[timer.phase]}, {STATUS_LABELS[timer.status]}.
      </p>

      <PomodoroActivity controller={controller} />
    </>
  );
}

export { PomodoroPage, PomodoroSettingsDialog };
