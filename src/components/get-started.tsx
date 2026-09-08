import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check, ChevronRight, X } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { CheckboxIndicator } from "@/components/ui/checkbox";
import type { GuideStepId } from "@/lib/guide";
import { popoverMotion, TRANSITION } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One line to say what the step is and one to say how it is done. The how is
 * the whole guide: each step is finished in the app itself, not read about,
 * and ticks itself the moment the thing exists.
 */
const STEP_COPY: Record<GuideStepId, { title: string; hint: string }> = {
  write: {
    title: "Write a task",
    hint: "Type a name above and press Enter.",
  },
  date: {
    title: "Give it a date",
    hint: "Type it into the name: “tmr”, “friday” or “sep 12 at 3pm”.",
  },
  tag: {
    title: "Add a tag",
    hint: "Type “#” in the name, or use the Tags chip under it.",
  },
  focus: {
    title: "Focus on it",
    hint: "Start a round in Pomodoro. The minutes are credited to the task.",
  },
  keep: {
    title: "Keep it on your computer",
    hint: "Choose a folder once. Every change is saved there.",
  },
};

export interface GetStartedStep {
  id: GuideStepId;
  done: boolean;
}

interface GetStartedProps {
  /** The launcher is on screen. */
  shown: boolean;
  /** The list is opened out above the launcher. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Put the whole thing away. */
  onHide: () => void;
  steps: GetStartedStep[];
  /** Take the reader to where the step is done. */
  onStep: (id: GuideStepId) => void;
  /** Open the long-form tour, for whoever wants to read after all. */
  onOpenTour: () => void;
}

/** A thin track that fills to the share of steps done. */
function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full origin-left rounded-full bg-primary transition-[scale] duration-base ease-out-cubic"
        style={{ scale: `${total === 0 ? 0 : done / total} 1` }}
      />
    </div>
  );
}

/**
 * The launcher and the list it opens into, pinned to the corner so it stays
 * put while the reader moves between views doing the steps. It is a card and
 * not a dialog on purpose: nothing behind it is blocked, because the steps
 * are done behind it. The count on the launcher is the reminder; the list
 * opens on a first visit and when asked, and closes with Escape or the X
 * without being finished.
 */
function GetStarted({
  shown,
  expanded,
  onExpandedChange,
  onHide,
  steps,
  onStep,
  onOpenTour,
}: GetStartedProps) {
  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const firstStepRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(expanded);

  const done = steps.filter((step) => step.done).length;
  const total = steps.length;
  const remaining = total - done;
  const complete = total > 0 && remaining === 0;
  const nextStep = steps.find((step) => !step.done);

  // Focus follows an opening the reader asked for; the one on a first visit
  // leaves the caret where the page put it, which is the task name field
  // the first step points at.
  useEffect(() => {
    const was = wasExpandedRef.current;
    wasExpandedRef.current = expanded;
    if (expanded && !was) firstStepRef.current?.focus();
  }, [expanded]);

  // The last tick opens the list, so finishing is seen and not only counted.
  const remainingRef = useRef(remaining);
  useEffect(() => {
    const before = remainingRef.current;
    remainingRef.current = remaining;
    if (shown && before > 0 && remaining === 0) onExpandedChange(true);
  }, [shown, remaining, onExpandedChange]);

  const collapse = () => {
    onExpandedChange(false);
    launcherRef.current?.focus();
  };

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    collapse();
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
      <AnimatePresence initial={false}>
        {shown && expanded ? (
          <motion.section
            key="panel"
            id={panelId}
            aria-label="Get started"
            onKeyDown={closeOnEscape}
            {...popoverMotion("above")}
            className="pointer-events-auto w-[min(22rem,100%)] origin-bottom-right overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-popover"
          >
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
                  {complete ? "All set" : "Get started"}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
                  {complete
                    ? "Everything stays on this computer."
                    : `${done} of ${total} done`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1.5 -mt-1.5 shrink-0 text-muted-foreground"
                aria-label="Close"
                title="Close"
                onClick={collapse}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className="px-4">
              <ProgressBar done={done} total={total} />
            </div>

            {complete ? (
              <div className="flex flex-col items-center gap-3 px-4 pt-6 pb-3 text-center">
                <BrandMark className="size-9 text-primary" />
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                  You have written a task, dated and tagged it, focused on it
                  and kept it. The rest is the same five things again.
                </p>
              </div>
            ) : (
              <ol className="grid gap-0.5 px-2 pt-3 pb-1">
                {steps.map((step) => {
                  const { title, hint } = STEP_COPY[step.id];
                  const next = step.id === nextStep?.id;
                  return (
                    <li key={step.id}>
                      <button
                        ref={next ? firstStepRef : undefined}
                        type="button"
                        onClick={() => onStep(step.id)}
                        aria-current={next ? "step" : undefined}
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-ui hover:bg-accent outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/70",
                          step.done && "text-muted-foreground",
                        )}
                      >
                        <CheckboxIndicator checked={step.done} className="mt-px" />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm font-medium leading-5",
                              step.done ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {title}
                            {step.done ? <span className="sr-only"> (done)</span> : null}
                          </span>
                          {/* Only the steps still to do explain themselves;
                              a finished one has nothing left to say. */}
                          <AnimatePresence initial={false}>
                            {step.done ? null : (
                              <motion.span
                                key="hint"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1, transition: TRANSITION.base }}
                                exit={{ height: 0, opacity: 0, transition: TRANSITION.fast }}
                                className="block overflow-hidden"
                              >
                                <span className="block pt-0.5 text-pretty text-[0.8125rem] leading-snug text-muted-foreground">
                                  {hint}
                                </span>
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                        {step.done ? null : (
                          <ChevronRight
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-ui group-hover:translate-x-0.5 group-hover:text-foreground"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex items-center gap-2 px-4 pt-2 pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto -ml-2 text-muted-foreground"
                onClick={onOpenTour}
              >
                <BookOpen aria-hidden="true" />
                Full tour
              </Button>
              {complete ? (
                <Button size="sm" onClick={onHide}>
                  Done
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onHide}>
                  Hide
                </Button>
              )}
            </div>
          </motion.section>
        ) : shown ? (
          <motion.button
            key="launcher"
            ref={launcherRef}
            type="button"
            aria-expanded={false}
            aria-controls={panelId}
            onClick={() => onExpandedChange(true)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: TRANSITION.base }}
            exit={{ opacity: 0, y: 8, transition: TRANSITION.fast }}
            className="pointer-events-auto inline-flex h-10 items-center gap-2.5 rounded-full bg-primary pr-2 pl-3 text-sm font-medium text-primary-foreground shadow-toast transition-ui hover:brightness-110 active:scale-[0.98] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background pointer-coarse:h-11"
          >
            {complete ? (
              <Check aria-hidden="true" className="size-4" strokeWidth={3} />
            ) : (
              <ProgressRing done={done} total={total} />
            )}
            {complete ? "All set" : "Get started"}
            {/* The count is the reminder: how much is left, at a glance,
                from any view. */}
            <span
              className={cn(
                "flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-xs font-semibold tabular-nums",
                complete && "sr-only",
              )}
            >
              {remaining}
              <span className="sr-only"> steps left</span>
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The share done as an arc, small enough to sit in a line of text. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const progress = total === 0 ? 0 : done / total;
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-[1.125rem] -rotate-90">
      <circle cx="9" cy="9" r={radius} fill="none" strokeWidth="2.5" className="stroke-primary-foreground/30" />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        className="stroke-primary-foreground transition-[stroke-dashoffset] duration-base ease-out-cubic"
      />
    </svg>
  );
}

export { GetStarted };
