import { useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** One of the two is required: the group has to be named to a screen reader. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Segments share the width evenly rather than sizing to their labels. */
  stretch?: boolean;
  /**
   * Only the icons are drawn; the labels stay in the accessibility tree and
   * come back as the hover title. For rows too narrow to spell the options out.
   */
  iconOnly?: boolean;
  /**
   * `solid` fills the selected segment with the accent -- for a choice the eye
   * should land on. `raised` lifts it off the track instead, for a control that
   * lives permanently on screen and should not outshout what surrounds it.
   */
  variant?: "solid" | "raised";
  className?: string;
}

/**
 * A row of options where exactly one is on. The selected pill is a single
 * element that moves between the segments -- `layoutId` is motion's shared
 * layout transition, so the highlight slides from the old segment to the new
 * one instead of blinking out and back in somewhere else. `useId` keeps two
 * controls on screen at once from animating into each other.
 *
 * It is a real radiogroup: one tab stop, and the arrow keys walk it, which is
 * what the pattern promises and what a row of separate buttons cannot give.
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  stretch = false,
  iconOnly = false,
  variant = "solid",
  className,
  ...labelling
}: SegmentedControlProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const highlightId = useId();
  const reduceMotion = useReducedMotion();
  const selectedIndex = options.findIndex((option) => option.id === value);

  const moveTo = (index: number) => {
    // Wraps, the way a radio group does: the ends of the row are not walls.
    const next = (index + options.length) % options.length;

    onValueChange(options[next].id);
    rowRef.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };

    if (event.key in steps) {
      event.preventDefault();
      moveTo(index + steps[event.key]);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : options.length - 1);
    }
  };

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      {...labelling}
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border border-input bg-background p-0.5 shadow-sm",
        stretch && "w-full",
        className,
      )}
    >
      {options.map((option, index) => {
        const checked = index === selectedIndex;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            data-index={index}
            title={iconOnly ? option.label : undefined}
            tabIndex={checked || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-[color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70",
              // The narrowest phone has to fit three of these, so a stretched row
              // keeps the padding the grid it replaced used.
              stretch && "min-h-11 flex-1 px-2",
              iconOnly && "px-0",
              checked
                ? variant === "solid"
                  ? "text-primary-foreground"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {checked ? (
              <motion.span
                aria-hidden="true"
                layoutId={highlightId}
                className={cn(
                  "absolute inset-0 rounded-full",
                  variant === "solid"
                    ? "bg-primary"
                    : // The track is a well cut into the surface, so the selected
                      // segment has to come back up out of it: on a dark page the
                      // shadow does nothing, and only the lighter surface reads.
                      "bg-popover shadow-thumb dark:bg-secondary",
                )}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 42 }
                }
              />
            ) : null}
            <span className="relative flex items-center gap-2">
              {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
              <span className={cn(iconOnly && Icon && "sr-only")}>{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
