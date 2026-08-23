import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ChevronDown } from "lucide-react";

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
  formatValue?: (value: number) => string;
  onValueChange: (value: number) => void;
  "aria-label": string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface Placement {
  above: boolean;
  maxHeight: number;
}

const MIN_LIST_HEIGHT = 96;
const MAX_LIST_HEIGHT = 192;

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
    setOpen(false);
    setActiveIndex(-1);
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
      setOpen(false);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      setDraft(null);
      setOpen(false);
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
          setOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="peer h-11 w-full rounded-md border border-input bg-background py-2 pl-3 pr-8 text-sm tabular-nums text-foreground shadow-sm ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            setOpen(false);
            return;
          }
          openList();
        }}
        className="absolute right-0 top-0 flex h-11 w-8 items-center justify-center text-muted-foreground disabled:opacity-50"
      >
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ maxHeight: placement.maxHeight }}
          className={cn(
            "absolute inset-x-0 z-50 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-1 shadow-[0_12px_32px_rgba(0,0,0,0.16),0_0_0_1px_rgba(0,0,0,0.06)]",
            placement.above ? "bottom-full mb-1" : "top-full mt-1",
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
        </ul>
      ) : null}
    </div>
  );
}

function measurePlacement(input: HTMLElement): Placement {
  const rect = input.getBoundingClientRect();
  const bounds = scrollParentRect(input);
  const above = rect.top - bounds.top;
  const below = bounds.bottom - rect.bottom;
  const room = Math.max(above, below);

  return {
    above: above > below,
    maxHeight: Math.max(
      MIN_LIST_HEIGHT,
      Math.min(MAX_LIST_HEIGHT, room - 12),
    ),
  };
}

/** Bounds of the nearest scrolling ancestor, which is what clips the list. */
function scrollParentRect(node: HTMLElement): { top: number; bottom: number } {
  let current = node.parentElement;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") {
      return current.getBoundingClientRect();
    }
    current = current.parentElement;
  }

  return { top: 0, bottom: window.innerHeight };
}

export { NumberCombobox };
