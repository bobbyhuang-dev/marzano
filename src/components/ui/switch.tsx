import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A compact settings switch with a full-size touch target. */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          // Same reason as the checkbox: the ring belongs on the track, not on the
          // invisible 2.75rem target around it.
          "flex h-6 w-11 items-center rounded-full p-0.5 transition-[background-color,box-shadow] duration-200 ease-out group-focus-visible:ring-[3px] group-focus-visible:ring-ring/70",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full bg-background shadow-thumb transition-transform duration-200 ease-out",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  ),
);
Switch.displayName = "Switch";

export { Switch };
