import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  ExternalLink,
  FileJson,
  FolderOpen,
  Plus,
  Timer,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { REPOSITORY_URL } from "@/components/settings-dialog";
import { TagChip } from "@/components/tag-chip";
import { DueDateText } from "@/components/task-due-date";
import { Button } from "@/components/ui/button";
import { CheckboxIndicator } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToday } from "@/hooks/use-today";
import { supportsLocalFolders } from "@/lib/local-data";
import { TRANSITION } from "@/lib/motion";
import { formatFocusDuration } from "@/lib/pomodoro";
import { TAG_COLORS } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * The one task the walkthrough follows from being typed to being saved, so
 * every step shows the same thing a stage further on rather than a new
 * feature. Its date is tomorrow, so the colour it is drawn in is the colour
 * the reader will see on their own first task.
 */
const SAMPLE = {
  typed: "Call mum tmr #family",
  title: "Call mum",
  tag: { id: "guide-family", name: "family", color: TAG_COLORS[11].hex },
  focusedMs: 9 * 60_000,
} as const;

function sampleDueAt(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

/* ------------------------------------------------------------------------ */
/* The stages                                                               */
/* ------------------------------------------------------------------------ */

/**
 * The sample task as a row in the list: the same checkbox, name, date colour
 * and chip as the real one, without the row's controls. Every demo below is
 * built on this row so the reader meets one object, not five pictures.
 */
function SampleRow({
  dueAt,
  className,
  trailing,
}: {
  dueAt: string | null;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md bg-background px-3 py-2 shadow-card",
        className,
      )}
    >
      <CheckboxIndicator checked={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-foreground">
          {SAMPLE.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {dueAt ? <DueDateText dueAt={dueAt} /> : null}
          <TagChip tag={SAMPLE.tag} />
        </div>
      </div>
      {trailing}
    </div>
  );
}

/** The composer with the sample typed in, the date and the tag already lit. */
function WriteDemo({ dueAt }: { dueAt: string }) {
  const [before, phrase, , mention] = ["Call mum ", "tmr", " ", "#family"];
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-3 text-sm whitespace-pre shadow-sm">
          <span>{before}</span>
          <span className="rounded-xs bg-primary/15 shadow-[0_0_0_2px] shadow-primary/15">
            {phrase}
          </span>
          <span> </span>
          <span className="rounded-xs bg-foreground/10 shadow-[0_0_0_2px] shadow-foreground/10">
            {mention}
          </span>
          <span className="ml-px h-4 w-px animate-pulse bg-foreground" />
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm">
          <Plus className="size-4" />
          Add
        </span>
      </div>
      <SampleRow dueAt={dueAt} />
    </div>
  );
}

/**
 * The days ahead with the sample task sitting on tomorrow. Five rather than a
 * week: the dialog is too narrow for seven cells to hold a name uncut.
 */
function DatesDemo() {
  const today = new Date();
  const days = Array.from({ length: 5 }, (_, offset) => addDays(today, offset));

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-5 overflow-hidden rounded-md bg-background shadow-card">
        {days.map((day, offset) => (
          <div
            key={offset}
            className={cn(
              "flex min-h-[4.25rem] flex-col items-center gap-1 px-0.5 pt-2 pb-1.5",
              offset > 0 && "border-l border-border",
            )}
          >
            <span className="text-[0.625rem] font-medium uppercase leading-none text-muted-foreground">
              {format(day, "EEEEE")}
            </span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                offset === 0
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-foreground",
              )}
            >
              {format(day, "d")}
            </span>
            {offset === 1 ? (
              <>
                <span
                  className="hidden w-full truncate rounded-sm px-1 py-0.5 text-center text-[0.625rem] font-medium leading-none tracking-tight sm:block"
                  style={{ backgroundColor: SAMPLE.tag.color, color: "#000" }}
                >
                  {SAMPLE.title}
                </span>
                <span
                  className="size-1.5 rounded-full sm:hidden"
                  style={{ backgroundColor: SAMPLE.tag.color }}
                />
              </>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellRing className="size-3.5 shrink-0 text-due-today" />
        <span>
          Tomorrow evening a reminder says <span className="font-medium text-foreground">Call mum</span> is due.
        </span>
      </div>
    </div>
  );
}

/** A round in progress with its minutes already credited to the sample task. */
function FocusDemo({ dueAt }: { dueAt: string }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.36;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-center gap-4 rounded-md bg-background px-4 py-3 shadow-card">
        <svg viewBox="0 0 56 56" className="size-14 shrink-0 -rotate-90">
          <circle cx="28" cy="28" r={radius} fill="none" strokeWidth="4" className="stroke-border" />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="stroke-primary"
          />
        </svg>
        <div className="grid gap-0.5">
          <span className="text-2xl font-semibold leading-none tabular-nums tracking-[-0.02em] text-foreground">
            16:00
          </span>
          <span className="text-xs text-muted-foreground">Focus, round 1 of 4</span>
        </div>
      </div>
      <SampleRow
        dueAt={dueAt}
        trailing={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground">
            <Timer className="size-3" />
            {formatFocusDuration(SAMPLE.focusedMs)}
          </span>
        }
      />
    </div>
  );
}

/** The folder on disk with the file the sample task lives in. */
function KeepDemo() {
  return (
    <div className="grid gap-2 rounded-md bg-background p-3 shadow-card">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <FolderOpen className="size-4 text-muted-foreground" />
        Marzano
      </div>
      <div className="ml-2 flex items-center gap-2 border-l border-border pl-3 text-sm text-foreground">
        <FileJson className="size-4 text-muted-foreground" />
        <span className="font-mono text-[0.8125rem]">marzano.json</span>
        <span className="ml-auto text-xs text-muted-foreground">1 task</span>
      </div>
      <div className="ml-2 flex items-center gap-2 border-l border-border pl-3 text-xs text-muted-foreground">
        <span className="size-4" />
        Saved on this computer. Nothing is uploaded.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* The steps                                                                */
/* ------------------------------------------------------------------------ */

interface GuideStep {
  id: string;
  /** The word on the progress track. */
  label: string;
  title: string;
  /** The one sentence the step exists to say. */
  lead: string;
  /** The fold's label, and behind it what the step would have said if it had room. */
  moreLabel: string;
  more: string[];
  demo: (dueAt: string) => ReactNode;
}

/**
 * One sentence, one picture, and the rest behind a fold: a tour is finished
 * only if every step can be read in the time it takes to press Next. The
 * first step is the destination -- the finished row -- so the reader knows
 * what the four that follow are building.
 */
const STEPS: GuideStep[] = [
  {
    id: "welcome",
    label: "Start",
    title: "Welcome to Marzano",
    lead: "A task list that stays on your computer, with due reminders, tags and a focus timer.",
    moreLabel: "More about Marzano",
    more: [
      "Five views sit in the sidebar: Tasks, Calendar, Pomodoro, Tags and Completed.",
      "There is no account. The guide stays in the sidebar for whenever you want it back.",
    ],
    demo: (dueAt) => (
      <div className="grid gap-3">
        <SampleRow dueAt={dueAt} />
        <p className="text-xs text-muted-foreground">
          The next four steps follow this one task from typing it to saving it.
        </p>
      </div>
    ),
  },
  {
    id: "write",
    label: "Write",
    title: "Write a task",
    lead: "Type the name. A date or a #tag in the words is picked up as you write.",
    moreLabel: "More about tasks",
    more: [
      "Deleting the words takes the date off again; picking a date by hand wins over them.",
      "The chips under the field add a date, tags, subtasks or a description by hand.",
      "Checking a task off shows an Undo for a few seconds.",
    ],
    demo: (dueAt) => <WriteDemo dueAt={dueAt} />,
  },
  {
    id: "dates",
    label: "Dates",
    title: "See when it lands",
    lead: "Calendar lays open tasks on their days, and a reminder fires when one falls due.",
    moreLabel: "More about dates",
    more: [
      "A day-only task comes due at the end of that day, so a date alone never nags at breakfast.",
      "Reminders reach a tab left open in the background.",
      "Above the list, tasks can be sorted by deadline and filtered to one tag.",
    ],
    demo: () => <DatesDemo />,
  },
  {
    id: "focus",
    label: "Focus",
    title: "Focus on it",
    lead: "Pick a task and start a round. The minutes are credited to that task.",
    moreLabel: "More about the timer",
    more: [
      "Focus and break lengths, the long-break interval and auto-start are in the timer's settings.",
      "The timer reads the clock, so a reload or a sleeping laptop loses nothing.",
    ],
    demo: (dueAt) => <FocusDemo dueAt={dueAt} />,
  },
  {
    id: "keep",
    label: "Keep",
    title: "Keep it on your computer",
    lead: "Choose a folder once. Every change is saved there while Marzano is open.",
    moreLabel: "More about your data",
    more: [
      "Choose the same folder in another browser to carry on where you left off.",
      "Browser storage holds a recovery copy of changes not yet on disk.",
      "Marzano is open source under the MIT licence.",
    ],
    demo: () => <KeepDemo />,
  },
];

/* ------------------------------------------------------------------------ */
/* The progress track                                                       */
/* ------------------------------------------------------------------------ */

interface StepTrackProps {
  steps: GuideStep[];
  index: number;
  onSelect: (index: number) => void;
}

/**
 * Where the reader is and what is left, as one control: a row of stops on a
 * line that fills up behind them. Every stop can be pressed, so the tour can
 * be skimmed as well as walked, but it costs one tab stop -- arrow keys move
 * between the stops -- so the Back and Next buttons are never buried.
 */
function StepTrack({ steps, index, onSelect }: StepTrackProps) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
      : event.key === "Home" ? -index
      : event.key === "End" ? steps.length - 1 - index
      : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(steps.length - 1, Math.max(0, index + delta));
    onSelect(next);
    buttonsRef.current[next]?.focus();
  };

  return (
    <div
      role="group"
      aria-label="Steps"
      onKeyDown={move}
      className="flex"
    >
      {steps.map((step, stepIndex) => {
        const done = stepIndex < index;
        const current = stepIndex === index;
        return (
          <button
            key={step.id}
            ref={(node) => {
              buttonsRef.current[stepIndex] = node;
            }}
            type="button"
            tabIndex={current ? 0 : -1}
            aria-current={current ? "step" : undefined}
            aria-label={`Step ${stepIndex + 1} of ${steps.length}: ${step.title}${done ? ", done" : ""}`}
            onClick={() => onSelect(stepIndex)}
            className="group relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md py-1 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70"
          >
            {/* The line, in two halves so it can end at the first stop and
                the last: the left half fills when this stop is reached, the
                right half when it is passed. */}
            <span aria-hidden="true" className="relative flex h-5 w-full items-center justify-center">
              {stepIndex > 0 ? (
                <span className="absolute inset-y-0 left-0 right-1/2 my-auto mr-2.5 h-px bg-border">
                  <span
                    className={cn(
                      "block h-full w-full origin-left bg-primary transition-ui",
                      done || current ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ) : null}
              {stepIndex < steps.length - 1 ? (
                <span className="absolute inset-y-0 left-1/2 right-0 my-auto ml-2.5 h-px bg-border">
                  <span
                    className={cn(
                      "block h-full w-full origin-left bg-primary transition-ui",
                      done ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              ) : null}
              <span
                className={cn(
                  "relative flex size-5 items-center justify-center rounded-full border transition-ui",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-background",
                  !done && !current && "border-input bg-background group-hover:border-foreground/45",
                )}
              >
                {done ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "size-2 rounded-full bg-primary transition-ui",
                      current ? "scale-100" : "scale-0",
                    )}
                  />
                )}
              </span>
            </span>
            <span
              className={cn(
                "text-[0.6875rem] leading-none transition-ui sm:text-xs",
                current ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* The fold                                                                 */
/* ------------------------------------------------------------------------ */

function MoreAbout({
  label,
  lines,
  open,
  onToggle,
  children,
}: {
  label: string;
  lines: string[];
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const regionId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={onToggle}
        className="-ml-1 inline-flex h-8 items-center gap-1 rounded-md px-1 text-sm text-muted-foreground transition-ui hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 transition-ui", open && "rotate-90")}
        />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="more"
            id={regionId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: TRANSITION.base }}
            exit={{ height: 0, opacity: 0, transition: TRANSITION.fast }}
            className="overflow-hidden"
          >
            <ul className="grid gap-2 pt-1 pb-1 pl-5">
              {lines.map((line) => (
                <li key={line} className="text-sm leading-relaxed text-muted-foreground">
                  {line}
                </li>
              ))}
              {children}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* The dialog                                                               */
/* ------------------------------------------------------------------------ */

interface GuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Leave the guide and put the caret in the task name field. */
  onWriteTask: () => void;
  /** Leave the guide and open Local data at the folder choice. */
  onChooseFolder: () => void;
}

/**
 * The walkthrough a first run opens itself, and the answer to "what is this?"
 * for anyone who skipped it. It is controlled rather than carrying its own
 * trigger: `App` opens it on a browser with nothing in it yet, from the
 * sidebar, and from the empty task list. Two steps hand off into the app
 * itself -- writing the first task, choosing the folder -- because a tour
 * that ends in the reader doing the thing has taught it.
 */
function GuideDialog({ open, onOpenChange, onWriteTask, onChooseFolder }: GuideDialogProps) {
  const [index, setIndex] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  /** Which way the last move went, so the step slides the way it is read. */
  const [direction, setDirection] = useState<1 | -1>(1);
  // Re-read past midnight, so a dialog left open still says "tomorrow".
  useToday();
  const dueAt = sampleDueAt();
  const nextRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Set when closing to hand focus somewhere other than back to the trigger. */
  const handoffRef = useRef<(() => void) | null>(null);

  const step = STEPS[index];
  const first = index === 0;
  const last = index === STEPS.length - 1;
  const canChooseFolder = supportsLocalFolders();

  // A step is read from its own top, however far down the one before went.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const goTo = (next: number) => {
    if (next === index) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
    setMoreOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Rewound on the way out rather than on the way in: the content is gone
    // by then, so reopening cannot flash the step it was left on.
    if (!nextOpen) {
      setIndex(0);
      setDirection(1);
      setMoreOpen(false);
    }
    onOpenChange(nextOpen);
  };

  const close = (handoff?: () => void) => {
    handoffRef.current = handoff ?? null;
    handleOpenChange(false);
  };

  // Dynamic variants rather than plain props, because `custom` on
  // AnimatePresence is the only way the step being removed hears about a
  // direction that changed after its last render: a Back press has to send
  // it out the side it came in from. The exit is the short length: with
  // `mode="wait"` the next step cannot start until this one has gone.
  const stepVariants = {
    enter: (towards: 1 | -1) => ({ opacity: 0, x: towards * 16 }),
    center: { opacity: 1, x: 0 },
    exit: (towards: 1 | -1) => ({
      opacity: 0,
      x: towards * -16,
      transition: TRANSITION.fast,
    }),
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // Left alone, focus lands on the first stop of the track, and an
          // opening Enter would go nowhere. Next is the way through.
          event.preventDefault();
          nextRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const handoff = handoffRef.current;
          if (!handoff) return;
          handoffRef.current = null;
          event.preventDefault();
          handoff();
        }}
      >
        {/* The dialog is named for a screen reader; on screen each step
            carries its own title. */}
        <DialogTitle className="sr-only">Guide</DialogTitle>
        <DialogDescription className="sr-only">
          What Marzano is, and how to use it, in five steps.
        </DialogDescription>

        <div className="shrink-0 px-5 pr-12 pt-3.5">
          <StepTrack steps={STEPS} index={index} onSelect={goTo} />
        </div>

        <DialogBody ref={scrollerRef} className="pt-4">
          {/* A floor under the shortest step, so the footer holds still
              while the steps change under it. */}
          <div className="min-h-[19.5rem]">
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={step.id}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  {first ? <BrandMark className="mb-2 size-9 text-primary" /> : null}
                  <h3 className="text-lg font-semibold leading-tight tracking-[-0.01em] text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {step.lead}
                  </p>
                </div>

                {/* A picture of the app, not the app: nothing in it can be
                    pressed, and the sentence above already says what it
                    shows. */}
                <div
                  aria-hidden="true"
                  className="select-none rounded-lg border border-border bg-muted/50 p-3 pointer-events-none dark:bg-muted/30"
                >
                  {step.demo(dueAt)}
                </div>

                <MoreAbout
                  label={step.moreLabel}
                  lines={step.more}
                  open={moreOpen}
                  onToggle={() => setMoreOpen((current) => !current)}
                >
                  {step.id === "keep" ? (
                    <li>
                      <a
                        href={REPOSITORY_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-ui hover:decoration-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70"
                      >
                        Read the source on GitHub
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    </li>
                  ) : null}
                </MoreAbout>
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogBody>

        <DialogFooter>
          {/* The way out of the tour without finishing it is always the first
              control in the row, never hidden behind the X alone. On the last
              step it is the way to finish without choosing a folder yet. */}
          {step.id === "write" ? (
            <Button variant="ghost" className="mr-auto" onClick={() => close(onWriteTask)}>
              Try it now
            </Button>
          ) : last ? (
            canChooseFolder ? (
              <Button variant="ghost" className="mr-auto" onClick={() => close()}>
                Later
              </Button>
            ) : null
          ) : (
            <Button variant="ghost" className="mr-auto" onClick={() => close()}>
              Skip
            </Button>
          )}
          {!first ? (
            <Button variant="outline" onClick={() => goTo(index - 1)}>
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
          ) : null}
          {last ? (
            canChooseFolder ? (
              <Button ref={nextRef} onClick={() => close(onChooseFolder)}>
                <FolderOpen aria-hidden="true" />
                Choose folder
              </Button>
            ) : (
              <Button ref={nextRef} onClick={() => close()}>
                Get started
              </Button>
            )
          ) : (
            <Button ref={nextRef} onClick={() => goTo(index + 1)}>
              {first ? "Start" : "Next"}
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </DialogFooter>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Step {index + 1} of {STEPS.length}: {step.title}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export { GuideDialog };
