import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { ColorSwatch } from "@/components/color-swatch";
import { readableTextColor, TAG_COLORS } from "@/lib/tags";

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
 *
 * The palette walks the hue wheel in thirties, so it reads as rows of ten on
 * a wide dialog and rows of six on a phone, both without a ragged last row.
 * The grid is capped rather than stretched: a gap wider than the swatch
 * makes the colours read as scattered, not as one palette.
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
      className="grid max-w-[16.5rem] grid-cols-6 gap-2 sm:max-w-none sm:grid-cols-10"
      {...aria}
    >
      {TAG_COLORS.map((color, index) => {
        const selected = index === selectedIndex;

        return (
          <ColorSwatch
            key={color.hex}
            selected={selected}
            fill={color.hex}
            markColor={readableTextColor(color.hex)}
            aria-label={color.name}
            title={color.name}
            data-index={index}
            // One tab stop: whichever swatch is selected, or the first one when
            // a stored colour is no longer in the palette.
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(color.hex)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          />
        );
      })}
    </div>
  );
}

export { TagColorPicker };
