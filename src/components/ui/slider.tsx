import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A native range input rather than a Radix slider: one control, no
 * dependency, and `accent-color` already paints the thumb and track in the
 * accent for both themes. The focus ring is the shared recipe, on the whole
 * track, so keyboard users see the same halo as everywhere else.
 */
const Slider = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn(
      "h-9 w-full min-w-0 cursor-pointer rounded-full accent-primary outline-none transition-ui pointer-coarse:h-10 focus-visible:ring-[3px] focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Slider.displayName = "Slider";

export { Slider };
