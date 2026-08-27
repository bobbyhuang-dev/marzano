import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { addDays, format, startOfDay, startOfMonth } from "date-fns";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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

// The dialog width is derived from the calendar: 7 day cells of 3.25rem plus the
// 1.5rem section padding on each side (7 * 3.25rem + 3rem = 25.75rem). Below that
// width the cells shrink to keep filling the padded content box, so every section
// -- header, quick select, calendar, time and footer -- shares the same insets.
const DIALOG_MAX_WIDTH = "25.75rem";
// Rows give height back on short screens: the sections around the calendar need
// roughly 33rem, and a month needs seven rows (the caption plus six weeks).
const CALENDAR_STYLE = {
  "--calendar-cell-size": "clamp(2.5rem, calc((100vw - 2.25rem) / 7), 3.25rem)",
  "--calendar-cell-height":
    "clamp(2.75rem, calc((100dvh - 33rem) / 7), var(--calendar-cell-size))",
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ above: false, below: false });
  const timeId = useId();
  const errorId = `${timeId}-error`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const syncOverflow = useCallback(() => {
    const area = scrollAreaRef.current;
    if (!area) return;

    const above = area.scrollTop > 1;
    const below = area.scrollTop + area.clientHeight < area.scrollHeight - 1;

    setOverflow((current) =>
      current.above === above && current.below === below
        ? current
        : { above, below },
    );
  }, []);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!open || !area) return;

    syncOverflow();

    const observer = new ResizeObserver(syncOverflow);
    observer.observe(area);
    if (area.firstElementChild) observer.observe(area.firstElementChild);

    return () => observer.disconnect();
  }, [open, syncOverflow]);

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

  const selectShortcut = (daysFromToday: number) => {
    selectDate(addDays(startOfDay(new Date()), daysFromToday));
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
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-0.25rem)] flex-col gap-0 overflow-hidden p-0"
        style={{ maxWidth: DIALOG_MAX_WIDTH }}
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogHeader className="shrink-0 p-4 pb-3 min-[420px]:p-6 min-[420px]:pb-4">
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
              {title}
            </DialogTitle>
            <DialogDescription>
              Pick a day. A time is optional.
            </DialogDescription>
          </DialogHeader>

          {/* Only the middle scrolls, so the title and the actions stay in view
              when the dialog runs out of height. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* The scroller takes its height from flex, not `h-full`: the form
                above it is sized by its own content, so a percentage height has
                nothing definite to resolve against and would grow to fit the
                content instead -- spilling over the actions below it. */}
            <div
              ref={scrollAreaRef}
              onScroll={syncOverflow}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              <div>
                <div className="border-y border-border bg-muted/35 p-4 min-[420px]:px-6">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Quick select
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectShortcut(1)}
                    >
                      Tomorrow
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectShortcut(7)}
                    >
                      Next week
                    </Button>
                  </div>
                </div>

                <div className="flex justify-center px-4 py-3 min-[420px]:px-6 min-[420px]:py-4">
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

                <div className="grid gap-3 border-t border-border p-4 min-[420px]:p-6">
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
                        onValueChange={(meridiem) =>
                          updateTime({ meridiem })
                        }
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
                          "relative flex size-12 shrink-0 items-center justify-center text-muted-foreground transition-transform active:scale-90 disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100",
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
            </div>

            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-background to-transparent transition-opacity duration-150",
                overflow.above ? "opacity-100" : "opacity-0",
              )}
            />
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity duration-150",
                overflow.below ? "opacity-100" : "opacity-0",
              )}
            />
          </div>

          <div className="grid shrink-0 gap-2 border-t border-border p-4 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between min-[420px]:p-6">
            <Button
              type="button"
              variant="ghost"
              disabled={!selectedDate}
              onClick={() => {
                setSelectedDate(undefined);
                setTime("");
                setError("");
              }}
            >
              Clear date
            </Button>
            <div className="grid grid-cols-2 gap-2 min-[420px]:flex">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save due date</Button>
            </div>
          </div>
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
