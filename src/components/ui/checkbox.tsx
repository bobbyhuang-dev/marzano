import * as React from "react";
import { Check } from "lucide-react";

import type { Importance } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** A task's importance, which colours the circle while it is unchecked. */
  importance?: Importance;
}

/**
 * The open circle in the importance colour, with a faint fill of it, so the
 * level reads at a glance without a separate badge. Written out whole so
 * Tailwind sees every class; unmarked keeps the plain grey circle.
 */
const IMPORTANCE_CIRCLE: Record<Importance, string> = {
  0: "border-input bg-transparent group-hover:border-foreground/45",
  1: "border-2 border-importance-low bg-importance-low/10 group-hover:bg-importance-low/20",
  2: "border-2 border-importance-medium bg-importance-medium/10 group-hover:bg-importance-medium/20",
  3: "border-2 border-importance-high bg-importance-high/10 group-hover:bg-importance-high/20",
};

/**
 * The box on its own, for rows that are themselves the control: a list item can
 * carry `role="checkbox"` and still show the same mark as a standalone one.
 */
function CheckboxIndicator({
  checked,
  importance = 0,
  className,
}: {
  checked: boolean;
  importance?: Importance;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-ui group-active:scale-90",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : IMPORTANCE_CIRCLE[importance],
        className,
      )}
    >
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className={cn(
          "size-3.5 transition-ui",
          checked ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}

/**
 * The circle is 1.25rem so it sits alongside a line of text, but the button
 * around it keeps the hit area every other control in the app has: 2.25rem,
 * and 2.5rem under a finger.
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, importance, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none pointer-coarse:size-10 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* The hit area is mostly empty space, so the ring lands on the mark
          itself rather than floating a halo around nothing. */}
      <CheckboxIndicator
        checked={checked}
        importance={importance}
        className="group-focus-visible:ring-[3px] group-focus-visible:ring-ring/70"
      />
    </button>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox, CheckboxIndicator };
