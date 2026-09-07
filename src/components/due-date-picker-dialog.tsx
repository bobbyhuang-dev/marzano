import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import {
  addDays,
  format,
  isSameDay,
  isWeekend,
  nextSaturday,
  startOfDay,
  startOfMonth,
} from "date-fns";
import {
  CalendarRange,
  type LucideIcon,
  Sofa,
  Sun,
  Sunrise,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberCombobox } from "@/components/ui/number-combobox";
import { OptionCombobox } from "@/components/ui/option-combobox";
import {
  SEGMENT_FOCUS_RING,
  SEGMENT_RADIUS,
  SquircleSegment,
} from "@/components/ui/squircle-segment";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";
import {
  dueAtToDeadline,
  isoToLocalDate,
  isoToLocalTime,
  localDateAndTimeToIso,
  localDateToDueValue,
} from "@/lib/tasks";

const MINUTE_STEP = 5;
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const MERIDIEM_OPTIONS = ["AM", "PM"] as const;

type Meridiem = (typeof MERIDIEM_OPTIONS)[number];

interface TimeParts {
  hour12: number;
  minutes: number;
  meridiem: Meridiem;
}

const FALLBACK_TIME_PARTS: TimeParts = {
  hour12: 9,
  minutes: 0,
  meridiem: "AM",
};

interface QuickPick {
  id: string;
  icon: LucideIcon;
  label: (today: Date) => string;
  resolve: (today: Date) => Date;
}

// Each pick shows the day it resolves to, so the two that can coincide (Friday's
// "Tomorrow" and "This weekend") are not a surprise. The weekend pick is always
// a Saturday: once the weekend has started, "this weekend" would either be
// today, which has its own button, or a day already gone, so it becomes the
// next one.
const QUICK_PICKS: QuickPick[] = [
  {
    id: "today",
    icon: Sun,
    label: () => "Today",
    resolve: (today) => today,
  },
  {
    id: "tomorrow",
    icon: Sunrise,
    label: () => "Tomorrow",
    resolve: (today) => addDays(today, 1),
  },
  {
    id: "weekend",
    icon: Sofa,
    label: (today) => (isWeekend(today) ? "Next weekend" : "This weekend"),
    resolve: (today) => nextSaturday(today),
  },
  {
    id: "next-week",
    icon: CalendarRange,
    label: () => "Next week",
    resolve: (today) => addDays(today, 7),
  },
];

function pad(part: number): string {
  return String(part).padStart(2, "0");
}

/** Splits a stored `HH:mm` value into the parts the pickers show. */
function toTimeParts(time: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return {
    hour12: hours % 12 === 0 ? 12 : hours % 12,
    minutes,
    meridiem: hours < 12 ? "AM" : "PM",
  };
}

function fromTimeParts({ hour12, minutes, meridiem }: TimeParts): string {
  const hours = (hour12 % 12) + (meridiem === "PM" ? 12 : 0);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** Every step, plus the current value when a saved task sits between steps. */
function minuteOptions(minutes: number): number[] {
  const steps = Array.from(
    { length: 60 / MINUTE_STEP },
    (_, index) => index * MINUTE_STEP,
  );

  return steps.includes(minutes)
    ? steps
    : [...steps, minutes].sort((a, b) => a - b);
}

// The narrow dialog width is derived from the calendar: 7 day cells of 3.25rem
// plus the 1.25rem gutter on each side (7 * 3.25rem + 2.5rem = 25.25rem).
// Below that width the cells shrink to keep filling the content box, so every
// row -- header, quick select, calendar, time and footer -- shares the same
// insets. From `md` up the quick select and the time move beside the
// calendar, and the extra width is theirs.
//
// Rows give height back on short screens. How much room the rest of the dialog
// takes depends on the layout, so the sections around the calendar are
// measured by `--due-dialog-surround`, set per breakpoint on the layout below:
// stacked, they need roughly 34rem; side by side, only the header, the footer
// and the calendar's own chrome remain above and below it.
const CALENDAR_STYLE = {
  "--calendar-cell-size": "clamp(2.5rem, calc((100vw - 2.75rem) / 7), 3.25rem)",
  "--calendar-cell-height":
    "clamp(2.75rem, calc((100dvh - var(--due-dialog-surround)) / 7), var(--calendar-cell-size))",
} as CSSProperties;

interface DueDatePickerDialogProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  title: string;
  trigger: ReactNode;
}

function DueDatePickerDialog({
  value,
  onValueChange,
  title,
  trigger,
}: DueDatePickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  // Empty means the task is due on the day itself, with no particular time.
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const timeId = useId();
  const errorId = `${timeId}-error`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      const currentDate = isoToLocalDate(value);
      setSelectedDate(currentDate);
      setVisibleMonth(currentDate ?? new Date());
      setTime(isoToLocalTime(value));
      setError("");
    }
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setVisibleMonth(date);
    setError("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portalled out of the DOM, but React still bubbles this
    // submit to whatever form renders the trigger, which would save that form
    // too.
    event.stopPropagation();

    if (!selectedDate) {
      onValueChange(null);
      setOpen(false);
      return;
    }

    const dueAt = time
      ? localDateAndTimeToIso(selectedDate, time)
      : localDateToDueValue(selectedDate);

    if (!dueAt) {
      setError("Choose a valid local time, or leave the time empty.");
      return;
    }

    // Keeping a due date that has already passed is fine; picking a new one in
    // the past is not. Days are handled by the calendar, this catches a time
    // earlier today.
    const deadline = dueAtToDeadline(dueAt);
    if (dueAt !== value && deadline !== null && deadline < Date.now()) {
      setError("That time has already passed today. Pick a later one.");
      return;
    }

    onValueChange(dueAt);
    setOpen(false);
  };

  const today = startOfDay(new Date());
  // A due date already in the past stays visible so it can be moved forward,
  // but no earlier day can be picked.
  const earliestMonth = startOfMonth(
    selectedDate && selectedDate < today ? selectedDate : today,
  );

  const timeParts = toTimeParts(time);
  const hasTime = timeParts !== null;
  const parts = timeParts ?? FALLBACK_TIME_PARTS;

  // Editing any picker while the time is empty fills in the other two, so a
  // single choice is enough to set a time.
  const updateTime = (changed: Partial<TimeParts>) => {
    setTime(fromTimeParts({ ...parts, ...changed }));
    setError("");
  };

  const summary = !selectedDate
    ? "No due date selected."
    : time
      ? `${format(selectedDate, "EEEE, MMMM d")} at ${formatTime(time)}`
      : `${format(selectedDate, "EEEE, MMMM d")}, any time that day.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="w-[calc(100%-0.25rem)] max-w-[25.25rem] md:max-w-[46rem]"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
              {title}
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            {/* Stacked, the sections read top to bottom in source order: quick
                select, calendar, time. From `md` the same three become a
                two-column grid with the calendar spanning the left and the
                other two stacked on the right, meeting at the calendar's
                middle; the grid placement classes are what moves them, so the
                tab order is unchanged. Space is the only thing between them:
                each section is recognisable on its own, so no rule or tint is
                needed to say where one ends. */}
            <div className="grid gap-y-4 [--due-dialog-surround:34rem] md:grid-cols-[auto_minmax(0,1fr)] md:gap-x-8 md:gap-y-6 md:[--due-dialog-surround:17rem]">
              <div
                role="group"
                aria-label="Quick select"
                className="grid grid-cols-2 gap-2 md:col-start-2 md:row-start-1 md:grid-cols-1 md:self-end"
              >
                {QUICK_PICKS.map((pick) => {
                  const date = pick.resolve(today);
                  const active =
                    selectedDate !== undefined && isSameDay(selectedDate, date);

                  return (
                    <Button
                      key={pick.id}
                      type="button"
                      variant="secondary"
                      aria-pressed={active}
                      onClick={() => selectDate(date)}
                      className={cn(
                        "h-auto justify-start gap-2.5 px-3 py-2 text-left",
                        active &&
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                    >
                      <pick.icon aria-hidden="true" />
                      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:justify-between md:gap-3">
                        <span className="truncate">{pick.label(today)}</span>
                        <span
                          className={cn(
                            "truncate text-xs font-normal",
                            active
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground",
                          )}
                        >
                          {format(date, "EEE, MMM d")}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>

              <div className="flex justify-center md:col-start-1 md:row-span-2 md:row-start-1 md:items-center">
                <Calendar
                  className="p-0"
                  style={CALENDAR_STYLE}
                  mode="single"
                  selected={selectedDate}
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  onSelect={(date) => {
                    if (date) selectDate(date);
                  }}
                  fixedWeeks
                  startMonth={earliestMonth}
                  disabled={{ before: today }}
                  timeZone={timeZone}
                />
              </div>

              <div className="grid gap-3 md:col-start-2 md:row-start-2 md:self-start">
                <div className="grid gap-2">
                  <Label htmlFor={timeId}>
                    Time{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  {/* Hours and minutes can be typed or picked from the list;
                        the clear control shares the row so the field costs no
                        extra height.

                        The squircle sits behind the controls rather than around
                        them: its clip path would cut off the lists, which have
                        to escape the field to open. The controls take `relative`
                        so they paint over the absolutely positioned pill. */}
                    <div className="relative flex items-center">
                      <SquircleSegment
                        leftRadius={SEGMENT_RADIUS}
                        rightRadius={SEGMENT_RADIUS}
                        className="absolute inset-0 bg-muted"
                      />
                      <NumberCombobox
                        id={timeId}
                        variant="seamless"
                        className="flex-1"
                        aria-label="Hour"
                        disabled={!selectedDate}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        value={hasTime ? parts.hour12 : null}
                        options={HOUR_OPTIONS}
                        min={1}
                        max={12}
                        onValueChange={(hour12) => updateTime({ hour12 })}
                      />
                      <span
                        aria-hidden="true"
                        className="relative text-sm text-muted-foreground"
                      >
                        :
                      </span>
                      <NumberCombobox
                        variant="seamless"
                        className="flex-1"
                        aria-label="Minutes"
                        disabled={!selectedDate}
                        value={hasTime ? parts.minutes : null}
                        options={minuteOptions(hasTime ? parts.minutes : 0)}
                        min={0}
                        max={59}
                        formatValue={pad}
                        onValueChange={(minutes) => updateTime({ minutes })}
                      />
                      {/* The app's own list, never a native <select>: the
                          platform would open its own picker and draw its own
                          focus box over the field. */}
                    <OptionCombobox
                      className="w-20"
                      aria-label="AM or PM"
                      disabled={!selectedDate}
                      value={hasTime ? parts.meridiem : null}
                      options={MERIDIEM_OPTIONS}
                      onValueChange={(meridiem) => updateTime({ meridiem })}
                    />
                    <button
                      type="button"
                      disabled={!hasTime}
                      aria-label="Clear time"
                      onClick={() => {
                        setTime("");
                        setError("");
                      }}
                      className={cn(
                        "relative flex size-10 shrink-0 items-center justify-center text-muted-foreground transition-transform active:scale-90 disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100",
                        SEGMENT_FOCUS_RING,
                      )}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  {error ? (
                    <p
                      id={errorId}
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {summary}
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              disabled={!selectedDate}
              onClick={() => {
                setSelectedDate(undefined);
                setTime("");
                setError("");
              }}
            >
              Clear date
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save due date</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "—";

  return format(new Date(2000, 0, 1, hours, minutes), "h:mm a");
}

export { DueDatePickerDialog };
