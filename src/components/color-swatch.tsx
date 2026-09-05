import { type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface ColorSwatchProps extends ComponentPropsWithoutRef<"button"> {
  selected: boolean;
  /**
   * The disc's colour. Omit it for a swatch carrying `data-swatch`, which
   * paints itself from that accent's own `--primary` in the theme on screen
   * (see `[data-swatch]` in index.css).
   */
  fill?: string;
  /** The check's colour; `data-swatch` swatches take `--primary-foreground`. */
  markColor?: string;
}

/**
 * One colour in a picker, drawn as a radio. It fills the grid cell it is put
 * in, so the picker decides the size through its columns and a max width
 * rather than each swatch carrying one. Selection is a halo in the
 * swatch's own colour around a slightly smaller disc -- the gap between them
 * is see-through, so it sits on any surface without a matching offset
 * colour, and the check inside carries the state for the pale colours whose
 * halo is faint. Focus is an outline rather than a ring on purpose: arrowing
 * the row moves selection with focus, so a second ring there would only
 * overwrite the halo.
 */
function ColorSwatch({
  selected,
  fill,
  markColor,
  className,
  style,
  ...props
}: ColorSwatchProps) {
  // The halo is `currentColor`, so the button's colour is the swatch's, and
  // the check below sets its own.
  const swatchStyle: CSSProperties | undefined = fill
    ? { ...style, color: fill }
    : style;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "relative flex aspect-square w-full items-center justify-center rounded-full inset-ring-2 transition-ui hover:scale-110 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95",
        selected ? "inset-ring-current" : "inset-ring-transparent",
        className,
      )}
      style={swatchStyle}
      {...props}
    >
      <span
        aria-hidden="true"
        data-swatch-disc=""
        className={cn(
          // The inset hairline keeps pale discs from dissolving into the
          // dialog; it is a class so it composes with the transitions.
          "absolute inset-0 rounded-full shadow-swatch transition-ui",
          selected && "scale-[0.72]",
        )}
        style={fill ? { backgroundColor: fill } : undefined}
      />
      <Check
        aria-hidden="true"
        data-swatch-mark=""
        strokeWidth={3}
        className={cn(
          "relative size-3.5 transition-ui",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
        style={markColor ? { color: markColor } : undefined}
      />
    </button>
  );
}

export { ColorSwatch };
