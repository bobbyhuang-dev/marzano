import { useCallback, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flag } from "lucide-react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMenuDismiss } from "@/hooks/use-menu-dismiss";
import { popoverMotion } from "@/lib/motion";
import {
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  isImportance,
  type Importance,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

/**
 * The flag takes the same colour as the circle it will paint, so picking a
 * level previews it. Unmarked stays muted: it is the absence of a colour.
 */
const IMPORTANCE_FLAG: Record<Importance, string> = {
  0: "text-muted-foreground",
  1: "fill-importance-low/25 text-importance-low",
  2: "fill-importance-medium/25 text-importance-medium",
  3: "fill-importance-high/25 text-importance-high",
};

interface ImportanceMenuProps {
  value: Importance;
  onValueChange: (importance: Importance) => void;
}

/**
 * The importance chip under the task page's composer. A menu rather than a
 * dialog like the chips beside it: four fixed choices are one click each, and
 * a window over the page for that would be more ceremony than the choice.
 * Built like the due sort menu, so the rows are radios and it closes on one.
 */
function ImportanceMenu({ value, onValueChange }: ImportanceMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss({
    open,
    container: containerRef,
    trigger: triggerRef,
    onClose: close,
  });

  const select = (importance: Importance) => {
    onValueChange(importance);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="true"
        aria-label={
          value === 0
            ? "Set importance"
            : `${IMPORTANCE_LABELS[value]} importance. Change importance`
        }
        className={cn(
          "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-input bg-background px-3 text-[0.8125rem] font-normal shadow-sm transition-ui pointer-coarse:h-9 hover:bg-accent hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70",
          value === 0 ? "text-muted-foreground" : "text-foreground",
        )}
      >
        <Flag aria-hidden="true" className={cn("size-3.5 shrink-0", IMPORTANCE_FLAG[value])} />
        <span className="truncate">
          {value === 0 ? "Importance" : IMPORTANCE_LABELS[value]}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            {...popoverMotion()}
            id={panelId}
            role="radiogroup"
            aria-label="Importance"
            className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(14rem,calc(100vw-2.5rem))] origin-top-left overflow-hidden rounded-lg bg-popover shadow-popover"
          >
            <ul className="py-1">
              {IMPORTANCE_LEVELS.map((level) => {
                const checked = level === value;

                return (
                  <li key={level}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => select(level)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-ui hover:bg-accent/60 outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/70"
                    >
                      <Flag
                        aria-hidden="true"
                        className={cn("size-4 shrink-0", IMPORTANCE_FLAG[level])}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          checked ? "font-medium text-foreground" : "text-foreground/85",
                        )}
                      >
                        {IMPORTANCE_LABELS[level]}
                      </span>
                      <Check
                        aria-hidden="true"
                        strokeWidth={3}
                        className={cn(
                          "size-4 shrink-0 text-foreground transition-ui",
                          checked ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// Lowest first, reading left to right the way the levels climb.
const FIELD_OPTIONS = [...IMPORTANCE_LEVELS].reverse().map((level) => ({
  id: String(level),
  label: IMPORTANCE_LABELS[level],
  icon: Flag,
  // Four labelled segments only just fit a phone's dialog, so the flags go
  // there; the circle shows the colour as soon as the task is saved.
  iconClassName: cn("max-sm:hidden", IMPORTANCE_FLAG[level]),
}));

/**
 * The same choice inside the task dialog, as a row rather than a menu: the
 * dialog body scrolls, and a menu opening inside it would be clipped by it.
 * `raised` keeps the selected segment neutral so its flag keeps its colour.
 */
function ImportanceField({
  value,
  onValueChange,
  "aria-labelledby": labelledBy,
}: ImportanceMenuProps & { "aria-labelledby": string }) {
  return (
    <SegmentedControl
      options={FIELD_OPTIONS}
      value={String(value)}
      onValueChange={(id) => {
        const level = Number(id);
        if (isImportance(level)) onValueChange(level);
      }}
      aria-labelledby={labelledBy}
      variant="raised"
      stretch
    />
  );
}

export { ImportanceField, ImportanceMenu };
