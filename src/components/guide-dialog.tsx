import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  DatabaseBackup,
  ExternalLink,
  ListTodo,
  ShieldCheck,
  Tags as TagsIcon,
  Timer,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { REPOSITORY_URL } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface GuideStep {
  id: string;
  /** The card's glyph. The welcome card has none: it shows the mark itself. */
  icon?: LucideIcon;
  title: string;
  /** One line on what the step is, before the three things it can do. */
  summary: string;
  points: string[];
  link?: { label: string; href: string };
}

/**
 * One card per part of the app, in the order someone meets them: what this is,
 * why it can be trusted, then the four views and the file that gets the data
 * out again. Each card is three points, because a tour nobody finishes teaches
 * nothing -- the detail is in the app, which is one press away behind it.
 */
const GUIDE_STEPS: GuideStep[] = [
  {
    id: "welcome",
    title: "Welcome to Marzano",
    summary:
      "A focused task list with due reminders, tags and a Pomodoro timer — and nothing else.",
    points: [
      "Five views sit in the sidebar: Tasks, Calendar, Pomodoro, Tags and Completed.",
      "There is no account to make and nothing to set up. Type a task and it is saved.",
      "This takes a minute to read, and it stays in the sidebar under Guide.",
    ],
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Private by design",
    summary:
      "Your tasks stay in this browser. Marzano has nowhere else to put them.",
    points: [
      "Everything is kept in this browser's own storage — no account, no server, no profile.",
      "The app makes no network calls, so nothing is uploaded, tracked or sold, and it works offline.",
      "It is open source under the MIT licence, so none of that has to be taken on trust.",
    ],
    link: { label: "Read the source on GitHub", href: REPOSITORY_URL },
  },
  {
    id: "tasks",
    icon: ListTodo,
    title: "Tasks",
    summary: "The list itself: name a task, add what it needs, check it off.",
    points: [
      "The due date and the tags under the name are both optional — a name is enough.",
      "Checking a task off raises a toast with an Undo, in case the wrong row was hit.",
      "The row above the list orders tasks by deadline and filters them down to a tag.",
    ],
  },
  {
    id: "due",
    icon: CalendarDays,
    title: "Due dates and the calendar",
    summary:
      "A deadline is either a day or a day and a time, and Marzano says when it lands.",
    points: [
      "Day-only tasks come due at the end of that day; the picker has Tomorrow and Next week.",
      "A reminder is raised when a task falls due, including in a tab left open in the background.",
      "Calendar lays your open tasks out on the days they are due, a week or a month at a time.",
    ],
  },
  {
    id: "pomodoro",
    icon: Timer,
    title: "Pomodoro",
    summary:
      "A focus timer wired into the list, so the time you spend lands on the task you spent it on.",
    points: [
      "Pick a task, start a round, and its focus time is credited to that task.",
      "Focus, both break lengths, the long-break interval and auto-start are all yours to set.",
      "The timer is read from the clock, so a reload or a sleeping machine cannot lose a round.",
    ],
  },
  {
    id: "tags",
    icon: TagsIcon,
    title: "Tags",
    summary: "Colour-coded labels for grouping work by subject, project or place.",
    points: [
      "Thirty colours, and each new tag is offered the first one you have not used.",
      "Every tag has its own page, listing the work behind it and how much is still open.",
      "The same tags drive the filter on the task page, so one press narrows the list.",
    ],
  },
  {
    id: "keep",
    icon: DatabaseBackup,
    title: "Keep a copy, then make it yours",
    summary:
      "Data in one browser is data in one place: Backup is how it travels and how it survives.",
    points: [
      "Backup writes a single JSON file holding your tasks, tags and Pomodoro history.",
      "Importing merges by default — each record kept from whichever copy was edited last.",
      "Settings carries the theme, seven accent colours and the display size.",
    ],
  },
];

function StepCard({ step }: { step: GuideStep }) {
  const Icon = step.icon;

  return (
    <div className="grid gap-4">
      {/* The welcome card is the mark itself; the rest keep a tile in its
          colour rather than the muted medallion the empty states use, because
          this is still the app introducing itself, not a status. */}
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-[0.625rem] bg-primary text-primary-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      ) : (
        <BrandMark className="size-10 text-primary" />
      )}
      <div className="grid gap-1.5">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
          {step.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.summary}
        </p>
      </div>
      <ul className="grid gap-2.5">
        {step.points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"
          >
            <span
              aria-hidden="true"
              className="mt-[0.5625rem] size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {step.link ? (
        <Button variant="outline" className="justify-start" asChild>
          <a href={step.link.href} target="_blank" rel="noreferrer noopener">
            <ExternalLink aria-hidden="true" />
            {step.link.label}
          </a>
        </Button>
      ) : null}
    </div>
  );
}

interface GuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The tour a first run opens itself, and the answer to "what is this?" for
 * anyone who skipped it. It is controlled rather than carrying its own trigger:
 * `App` opens it on a browser with nothing in it yet, from the sidebar, and
 * from the empty task list.
 */
function GuideDialog({ open, onOpenChange }: GuideDialogProps) {
  const [index, setIndex] = useState(0);
  /** Which way the last press moved, so the cards slide the way they are read. */
  const [direction, setDirection] = useState<1 | -1>(1);
  const nextRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const step = GUIDE_STEPS[index];
  const first = index === 0;
  const last = index === GUIDE_STEPS.length - 1;

  // A card is read from its own top, however far down the one before it went.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setIndex((current) =>
      Math.min(GUIDE_STEPS.length - 1, Math.max(0, current + delta)),
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Rewound on the way out rather than on the way in: the content is gone by
    // then, so reopening cannot flash the card it was left on.
    if (!nextOpen) {
      setIndex(0);
      setDirection(1);
    }
    onOpenChange(nextOpen);
  };

  // Dynamic variants rather than plain props, because `custom` on
  // AnimatePresence is the only way the card being removed hears about a
  // direction that changed after its last render: a Back press has to send it
  // out the side it came in from. The exit is the short length: with
  // `mode="wait"` the next card cannot start until this one has gone.
  const cardVariants = {
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
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          // Left alone, focus lands on Skip -- the first control in the DOM --
          // and an opening Enter would end the tour before it starts.
          event.preventDefault();
          nextRef.current?.focus();
        }}
      >
        {/* The dialog is named for a screen reader; on screen the card below
            carries the title, which changes with every step. */}
        <DialogTitle className="sr-only">Guide</DialogTitle>
        <DialogDescription className="sr-only">
          What Marzano is, and how to use it.
        </DialogDescription>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {/* A floor under the shortest card, so the footer holds still while
              the steps change under it. */}
          <div className="min-h-[19rem] p-5 min-[420px]:p-6">
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                key={step.id}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <StepCard step={step} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-border p-5 min-[420px]:p-6">
          {/* Position, not a control: the two buttons are the way through, and
              seven more tab stops would bury them. */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {GUIDE_STEPS.map((entry, entryIndex) => (
              <span
                key={entry.id}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-base ease-out-cubic",
                  entryIndex === index
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {first ? (
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Skip
              </Button>
            ) : (
              <Button variant="outline" onClick={() => go(-1)}>
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
            )}
            <Button
              ref={nextRef}
              onClick={() => (last ? handleOpenChange(false) : go(1))}
            >
              {last ? "Get started" : "Next"}
              {last ? null : <ArrowRight aria-hidden="true" />}
            </Button>
          </div>
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Step {index + 1} of {GUIDE_STEPS.length}: {step.title}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export { GuideDialog };
