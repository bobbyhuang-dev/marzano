import { useId, useRef, useState, type ReactNode } from "react";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import {
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  ListTodo,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Target,
  Timer,
  Trash2,
} from "lucide-react";

import { EmptyPanel } from "@/components/empty-panel";
import { TagChip, TagChipList } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const FOCUS_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90];
const SHORT_BREAK_OPTIONS = [3, 5, 10, 15, 20];
const LONG_BREAK_OPTIONS = [10, 15, 20, 25, 30, 45];
const INTERVAL_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

function formatCountdown(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(totalMinutes)}:${pad(seconds)}`;
}

function TimerProgress({
  remainingMs,
  plannedDurationMs,
  phase,
  status,
}: {
  remainingMs: number;
  plannedDurationMs: number;
  phase: PomodoroPhase;
  status: PomodoroStatus;
}) {
  const progress =
    plannedDurationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / plannedDurationMs))
      : 0;
  const degrees = Math.round(progress * 360);
  const time = formatCountdown(remainingMs);

  return (
    <div
      role="timer"
      aria-live="off"
      aria-atomic="true"
      aria-label={`${PHASE_LABELS[phase]}, ${status}, ${time} remaining`}
      className="relative flex size-60 shrink-0 items-center justify-center rounded-full p-2 sm:size-72 sm:p-2.5"
      style={{
        background: `conic-gradient(hsl(var(--primary)) ${degrees}deg, hsl(var(--muted)) ${degrees}deg)`,
      }}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-card shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        <span className="text-5xl font-semibold tracking-[-0.065em] tabular-nums text-foreground sm:text-6xl">
          {time}
        </span>
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
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  selectedTaskId: string | null;
  tagsById: Map<string, Tag>;
  onSelect: (taskId: string) => void;
  running: boolean;
  trigger?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Choose a focus task</DialogTitle>
          <DialogDescription>
            {running ? "The timer keeps running." : "Select one for this round."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-3 pb-3">
          {tasks.length === 0 ? (
            <EmptyPanel
              icon={ListTodo}
              title="No open tasks"
              description="Add a task on the Tasks page, then come back to focus."
            />
          ) : (
            <div role="group" aria-label="Open tasks" className="grid gap-1">
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
                      selected && "bg-secondary",
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
                      <span className="block break-words text-sm font-medium leading-5 text-foreground">
                        {task.title}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Clock3 className="size-3.5" aria-hidden="true" />
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
        "flex min-h-[4.75rem] items-center gap-4 px-4 py-3.5",
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

function SettingsSectionHeading({
  id,
  title,
  description,
  icon,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
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

function SettingsDialog({ controller }: { controller: PomodoroController }) {
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
          variant="outline"
          size="icon"
          aria-label="Pomodoro settings"
          title="Settings"
        >
          <Settings2 aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="focus:outline-none"
          >
            Pomodoro settings
          </DialogTitle>
          <DialogDescription>
            Changes apply next round and save automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4 sm:p-6">
          <section
            className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
            aria-labelledby="durations-heading"
          >
            <SettingsSectionHeading
              id="durations-heading"
              title="Durations"
              description="Focus and break lengths."
              icon={<Timer className="size-4" aria-hidden="true" />}
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
          </section>

          <section
            className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
            aria-labelledby="flow-heading"
          >
            <SettingsSectionHeading
              id="flow-heading"
              title="Session flow"
              description="Automatic starts."
              icon={<RotateCcw className="size-4" aria-hidden="true" />}
            />
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
              <SettingToggle
                title="Auto-start breaks"
                description="After focus ends."
                checked={settings.autoStartBreaks}
                onCheckedChange={(autoStartBreaks) =>
                  updateSettings({ autoStartBreaks })
                }
              />
              <SettingToggle
                title="Auto-start focus"
                description="After a break ends."
                checked={settings.autoStartFocus}
                onCheckedChange={(autoStartFocus) =>
                  updateSettings({ autoStartFocus })
                }
              />
            </div>
          </section>

          <section
            className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
            aria-labelledby="notifications-heading"
          >
            <SettingsSectionHeading
              id="notifications-heading"
              title="Notifications"
              description="End-of-round alerts."
              icon={<Bell className="size-4" aria-hidden="true" />}
            />
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
              <SettingToggle
                title="Round notifications"
                description="Chime and in-app alert."
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
                          ? "Turn on to allow system alerts for completed rounds."
                          : settings.desktopAlerts
                            ? "Show a persistent system alert when a round finishes."
                            : "System alerts are turned off."
                }
                checked={
                  settings.desktopAlerts && permission === "granted"
                }
                onCheckedChange={changeDesktopAlerts}
                disabled={
                  !settings.notifications ||
                  permission === "denied" ||
                  permission === "unsupported"
                }
              />
            </div>
          </section>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-card px-6 py-4 sm:items-center sm:justify-between">
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
          size="icon"
          className="text-muted-foreground"
          aria-label="Clear Pomodoro history"
          title="Clear history"
        >
          <Trash2 aria-hidden="true" />
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

function PomodoroInsights({ controller }: { controller: PomodoroController }) {
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
    <section className="mt-6" aria-label="Pomodoro activity">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric
            icon={<Timer aria-hidden="true" />}
            label="Today"
            value={formatFocusDuration(todayFocusMs)}
          />
          <Metric
            icon={<CheckCircle2 aria-hidden="true" />}
            label="Rounds"
            value={String(todaySessions)}
          />
          <Metric
            icon={<Target aria-hidden="true" />}
            label="Tasks"
            value={String(todayTaskIds.size)}
          />
        </div>

        <div className="border-t border-border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">7 days</h2>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatFocusDuration(weeklyTotalMs)}
            </span>
          </div>

          <div
            role="img"
            aria-label={`Seven day focus chart. ${days
              .map(
                ({ date, durationMs }) =>
                  `${format(date, "EEEE")}: ${formatFocusDuration(durationMs)}`,
              )
              .join(". ")}`}
            className="mt-5 grid h-32 grid-cols-7 gap-2 sm:gap-3"
          >
            {days.map(({ date, durationMs }) => {
              const height =
                durationMs === 0
                  ? 0
                  : Math.max(8, (durationMs / maxDayMs) * 100);

              return (
                <div
                  key={date.toISOString()}
                  className="flex min-w-0 flex-col items-center gap-2"
                >
                  <div className="flex min-h-0 w-full flex-1 items-end justify-center rounded-sm bg-muted">
                    <div
                      className="w-full rounded-sm bg-primary transition-[height] duration-300 ease-out"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">
                      {format(date, "EEE")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {history.length > 0 ? (
          <div className="border-t border-border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold text-foreground">Recent</h2>
              </div>
              <ClearHistoryDialog onClear={clearHistory} />
            </div>
            <ul
              className="mt-2 divide-y divide-border"
              aria-label="Recent focus sessions"
            >
              {history.slice(0, 3).map((session) => (
                <li
                  key={session.id}
                  className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full",
                      session.completed
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {session.completed ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <Pause className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {sessionTaskLabel(session)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(session.endedAt), "MMM d · h:mm a")}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                    {formatFocusDuration(session.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-5 sm:p-6">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-xl font-semibold tracking-[-0.025em] tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
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
    isFocus &&
    running &&
    timer.activeStartedAt !== null &&
    selectedTask
      ? Math.max(
          0,
          Math.min(
            timer.plannedDurationMs - timer.accumulatedMs,
            controller.now - timer.activeStartedAt,
          ),
        )
      : 0;
  const selectedFocusedMs =
    (selectedTask?.focusedMs ?? 0) + openSelectedSliceMs;
  const progressRound =
    (timer.completedFocusCount % settings.longBreakInterval) + 1;
  const primaryLabel = running
    ? isFocus
      ? "Pause focus"
      : "Pause break"
    : timer.status === "paused" || timer.accumulatedMs > 0
      ? isFocus
        ? "Resume focus"
        : "Resume break"
      : isFocus
        ? "Start focus"
        : "Start break";
  const canStart = !isFocus || selectedTask !== null;

  const completeCurrentTask = () => {
    if (!selectedTask) return;
    const hasAnotherTask = activeTasks.some(({ id }) => id !== selectedTask.id);
    onCompleteTask(selectedTask);
    if (hasAnotherTask) setTaskPickerOpen(true);
  };

  return (
    <>
      <div className="-mt-4 mb-4 flex justify-end">
        <SettingsDialog controller={controller} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col items-center p-6 sm:p-8 xl:p-10">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {isFocus ? (
                    <Target className="size-4" aria-hidden="true" />
                  ) : (
                    <Coffee className="size-4" aria-hidden="true" />
                  )}
                </span>
                {PHASE_LABELS[timer.phase]}
              </p>
              <div
                className="flex items-center gap-1.5"
                role="img"
                aria-label={`Round ${progressRound} of ${settings.longBreakInterval}`}
              >
                {Array.from(
                  { length: settings.longBreakInterval },
                  (_, index) => {
                    const completed =
                      timer.phase === "longBreak"
                        ? true
                        : index <
                          timer.completedFocusCount % settings.longBreakInterval;
                    const current = isFocus && index === progressRound - 1;

                    return (
                      <span
                        key={index}
                        aria-hidden="true"
                        className={cn(
                          "h-1.5 w-5 rounded-full bg-muted",
                          completed && "bg-foreground/35",
                          current && "bg-primary",
                        )}
                      />
                    );
                  },
                )}
              </div>
            </div>

            <div className="my-8 sm:my-10">
              <TimerProgress
                remainingMs={remainingMs}
                plannedDurationMs={timer.plannedDurationMs}
                phase={timer.phase}
                status={timer.status}
              />
            </div>

            <div className="flex w-full max-w-md items-center justify-center gap-2">
              <Button
                size="lg"
                className="min-w-44 flex-1 sm:flex-none"
                disabled={!running && !canStart}
                onClick={running ? controller.pause : controller.start}
              >
                {running ? (
                  <Pause aria-hidden="true" />
                ) : (
                  <Play aria-hidden="true" />
                )}
                {primaryLabel}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Restart ${PHASE_LABELS[timer.phase].toLowerCase()}`}
                title={`Restart ${PHASE_LABELS[timer.phase].toLowerCase()}`}
                disabled={!hasRoundProgress}
                onClick={controller.restart}
              >
                <RotateCcw aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={isFocus ? "End focus" : "Skip break"}
                title={isFocus ? "End focus" : "Skip break"}
                disabled={isFocus && !hasRoundProgress}
                onClick={controller.skip}
              >
                <SkipForward aria-hidden="true" />
              </Button>
            </div>
          </div>

          <aside className="border-t border-border bg-background/55 p-6 sm:p-8 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {isFocus ? "Focus task" : "Up next"}
              </h2>
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Target className="size-4" aria-hidden="true" />
              </span>
            </div>

            {selectedTask ? (
              <div className="mt-5">
                <p className="break-words text-lg font-semibold leading-7 tracking-[-0.02em] text-foreground">
                  {selectedTask.title}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {selectedTask.dueAt ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock3 className="size-4" aria-hidden="true" />
                      <span className="tabular-nums">
                        {formatDueDate(selectedTask.dueAt)}
                      </span>
                    </p>
                  ) : null}
                  {selectedFocusedMs > 0 ? (
                    <p
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                      aria-label={`${formatFocusDuration(selectedFocusedMs)} focused`}
                    >
                      <Timer className="size-4" aria-hidden="true" />
                      {formatFocusDuration(selectedFocusedMs)}
                    </p>
                  ) : null}
                  <TagChipList
                    tags={resolveTags(selectedTask.tagIds, tagsById)}
                  />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <TaskPickerDialog
                    open={taskPickerOpen}
                    onOpenChange={setTaskPickerOpen}
                    tasks={activeTasks}
                    selectedTaskId={selectedTask.id}
                    tagsById={tagsById}
                    onSelect={controller.selectTask}
                    running={running && isFocus}
                    trigger={
                      <Button variant="outline" className="w-full">
                        Change
                      </Button>
                    }
                  />
                  {isFocus ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={completeCurrentTask}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      Complete
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-8 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ListTodo className="size-5" aria-hidden="true" />
                </span>
                <TaskPickerDialog
                  open={taskPickerOpen}
                  onOpenChange={setTaskPickerOpen}
                  tasks={activeTasks}
                  selectedTaskId={null}
                  tagsById={tagsById}
                  onSelect={controller.selectTask}
                  running={false}
                  trigger={
                    <Button
                      className="mt-5 w-full"
                      disabled={activeTasks.length === 0}
                    >
                      <Target aria-hidden="true" />
                      Choose a task
                    </Button>
                  }
                />
                {activeTasks.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Add a task first.
                  </p>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </Card>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {PHASE_LABELS[timer.phase]}. {timer.status}.
      </p>

      <PomodoroInsights controller={controller} />
    </>
  );
}

export { PomodoroPage };
