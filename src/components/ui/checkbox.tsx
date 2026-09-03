import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * The box on its own, for rows that are themselves the control: a list item can
 * carry `role="checkbox"` and still show the same mark as a standalone one.
 */
function CheckboxIndicator({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-ui group-active:scale-90",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-transparent group-hover:border-foreground/45",
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
 * around it keeps the 2.75rem hit area every other control in the app has.
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* The hit area is 2.75rem of mostly empty space, so the ring lands on
          the mark itself rather than floating a halo around nothing. */}
      <CheckboxIndicator
        checked={checked}
        className="group-focus-visible:ring-[3px] group-focus-visible:ring-ring/70"
      />
    </button>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox, CheckboxIndicator };
