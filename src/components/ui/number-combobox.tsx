import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  claimListOpen,
  measurePlacement,
  MAX_LIST_HEIGHT,
  type Placement,
} from "@/components/ui/combobox-list";
import { SEGMENT_FOCUS_RING } from "@/components/ui/squircle-segment";
import { popoverMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface NumberComboboxProps {
  id?: string;
  /** `null` while the field is empty. */
  value: number | null;
  options: number[];
  min: number;
  max: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * `seamless` drops the border, fill and shadow for a field that sits on a
   * squircle segment which already draws the surface. The list is left alone —
   * it still has to read as a popover over whatever is behind it.
   */
  variant?: "outline" | "seamless";
  formatValue?: (value: number) => string;
  onValueChange: (value: number) => void;
  "aria-label": string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const FIELD_VARIANTS = {
  outline:
    // Text fields soften the focus ring into a halo (a half-opacity border and a
    // wider, fainter glow) rather than the full-strength ring buttons use: on the
    // neutral accent a hard gray outline reads as a mistake, not a highlight.
    "h-11 rounded-md border border-input bg-background shadow-sm transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-ring/50 focus-visible:ring-[4px] focus-visible:ring-ring/20",
  seamless: `h-12 bg-transparent ${SEGMENT_FOCUS_RING}`,
} as const;

const CHEVRON_VARIANTS = {
  outline: "h-11",
  seamless: "h-12",
} as const;

/**
 * A number field that can be typed into or picked from a list. The list opens
 * towards whichever side has room inside the nearest scrolling ancestor, so it
 * stays visible when the field sits near the edge of a scrollable dialog.
 */
function NumberCombobox({
  id,
  value,
  options,
  min,
  max,
  disabled,
  placeholder = "--",
  className,
  variant = "outline",
  formatValue = String,
  onValueChange,
  ...aria
}: NumberComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<Placement>({
    above: true,
    maxHeight: MAX_LIST_HEIGHT,
  });
  // A draft is only held while the field is being typed into.
  const [draft, setDraft] = useState<string | null>(null);
  const listId = `${useId()}-listbox`;
  const maxLength = Math.max(
    1,
    String(Math.max(Math.abs(min), Math.abs(max))).length,
  );

  const displayed =
    draft ?? (value === null ? "" : formatValue(value));

  // Everything that closes the list goes through here, so it also gives up
  // the claim that opening it took. `useCallback` keeps the identity stable
  // across renders, so re-claiming recognizes itself and does not close itself.
  const releaseRef = useRef<() => void>(() => {});
  const closeList = useCallback(() => {
    releaseRef.current();
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => () => releaseRef.current(), []);

  const commitDraft = () => {
    if (draft === null) return;

    const parsed = Number(draft);
    if (draft !== "" && Number.isInteger(parsed) && parsed >= min && parsed <= max) {
      onValueChange(parsed);
    }

    setDraft(null);
  };

  const selectOption = (option: number) => {
    setDraft(null);
    onValueChange(option);
    closeList();
  };

  const scrollActiveIntoView = () => {
    window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const openList = () => {
    if (disabled) return;

    // Close any other open field list first — see claimListOpen.
    releaseRef.current = claimListOpen(closeList);

    const input = inputRef.current;
    if (input) setPlacement(measurePlacement(input));

    const current = value === null ? -1 : options.indexOf(value);
    setActiveIndex(current);
    setOpen(true);
    scrollActiveIntoView();
  };

  const moveActive = (step: number) => {
    if (options.length === 0) return;

    setActiveIndex((current) => {
      const next = current === -1 ? (step > 0 ? 0 : options.length - 1) : current + step;
      return Math.min(options.length - 1, Math.max(0, next));
    });
    scrollActiveIntoView();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      // Never let the field submit the surrounding form by accident.
      event.preventDefault();
      if (open && activeIndex >= 0) {
        selectOption(options[activeIndex]);
        return;
      }
      commitDraft();
      closeList();
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        inputMode="numeric"
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        value={displayed}
        onChange={(event) => {
          setDraft(
            event.target.value.replace(/\D/g, "").slice(0, maxLength),
          );
          if (!open) openList();
        }}
        onFocus={(event) => event.target.select()}
        // Clicking the field opens the list too, so the choices are discoverable
        // without hunting for the chevron.
        onClick={() => {
          if (!open) openList();
        }}
        onBlur={() => {
          commitDraft();
          closeList();
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer w-full py-2 pl-3 pr-8 text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          FIELD_VARIANTS[variant],
        )}
        {...aria}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        // Toggling on mousedown keeps the input's focus and blur handling intact.
        onMouseDown={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          if (open) {
            closeList();
            return;
          }
          openList();
        }}
        className={cn(
          "absolute right-0 top-0 flex w-8 items-center justify-center text-muted-foreground disabled:opacity-50",
          CHEVRON_VARIANTS[variant],
        )}
      >
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            key="list"
            {...popoverMotion(placement.above ? "above" : "below")}
            ref={listRef}
            id={listId}
            role="listbox"
            style={{ maxHeight: placement.maxHeight }}
            className={cn(
              "absolute inset-x-0 z-50 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-1 shadow-popover dark:bg-popover",
              placement.above
                ? "bottom-full mb-1 origin-bottom"
                : "top-full mt-1 origin-top",
            )}
          >
            {options.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option === value}
                data-active={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={cn(
                  "flex h-9 cursor-pointer items-center rounded-sm px-3 text-sm tabular-nums text-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground",
                  option === value && "font-semibold",
                )}
              >
                {formatValue(option)}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export { NumberCombobox };
