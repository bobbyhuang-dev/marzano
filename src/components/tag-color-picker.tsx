import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check } from "lucide-react";

import { readableTextColor, TAG_COLORS } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** The rendered column count, which changes with the dialog width. */
function countColumns(grid: HTMLElement | null): number {
  if (!grid) return 1;

  const columns = window
    .getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter(Boolean).length;

  return Math.max(1, columns);
}

interface TagColorPickerProps {
  value: string;
  onValueChange: (hex: string) => void;
  "aria-label": string;
  "aria-describedby"?: string;
}

/**
 * The palette as a grid of swatches. It behaves like a radio group: one tab stop
 * for the whole grid, then the arrow keys walk it -- including up and down,
 * which follow the columns actually on screen rather than an assumed count.
 */
function TagColorPicker({
  value,
  onValueChange,
  ...aria
}: TagColorPickerProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedIndex = TAG_COLORS.findIndex((color) => color.hex === value);

  const moveTo = (index: number) => {
    const clamped = Math.min(TAG_COLORS.length - 1, Math.max(0, index));

    onValueChange(TAG_COLORS[clamped].hex);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${clamped}"]`)
      ?.focus();
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const columns = countColumns(gridRef.current);
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    };

    if (event.key in steps) {
      event.preventDefault();
      moveTo(index + steps[event.key]);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : TAG_COLORS.length - 1);
    }
  };

  return (
    <div
      ref={gridRef}
      role="radiogroup"
      className="grid grid-cols-5 gap-2.5 min-[400px]:grid-cols-6"
      {...aria}
    >
      {TAG_COLORS.map((color, index) => {
        const selected = index === selectedIndex;

        return (
          <button
            key={color.hex}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            title={color.name}
            data-index={index}
            // One tab stop: whichever swatch is selected, or the first one when
            // a stored colour is no longer in the palette.
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(color.hex)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              // The inset hairline keeps pale swatches from dissolving into the
              // dialog. It is a class, not an inline style, so the ring below
              // composes with it instead of being overwritten.
              "relative flex aspect-square w-full items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.09)] ring-offset-background transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95",
              selected && "ring-2 ring-foreground ring-offset-2",
            )}
            style={{ backgroundColor: color.hex }}
          >
            <Check
              aria-hidden="true"
              strokeWidth={3}
              className={cn(
                "size-[45%] transition-opacity duration-150 ease-out",
                selected ? "opacity-100" : "opacity-0",
              )}
              style={{ color: readableTextColor(color.hex) }}
            />
          </button>
        );
      })}
    </div>
  );
}

export { TagColorPicker };
