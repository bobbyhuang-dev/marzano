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

interface OptionComboboxProps<T extends string> {
  id?: string;
  /** `null` while the field is empty. */
  value: T | null;
  options: readonly T[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onValueChange: (value: T) => void;
  "aria-label": string;
}

/**
 * Picks one of a fixed set of options from the same list the NumberCombobox
 * opens. There is no native `select` underneath on purpose: the platform would
 * draw its own focus box and its own picker over the app's field.
 */
function OptionCombobox<T extends string>({
  id,
  value,
  options,
  disabled,
  placeholder = "--",
  className,
  onValueChange,
  ...aria
}: OptionComboboxProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<Placement>({
    above: true,
    maxHeight: MAX_LIST_HEIGHT,
  });
  const listId = `${useId()}-listbox`;

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

    const trigger = triggerRef.current;
    if (trigger) setPlacement(measurePlacement(trigger));

    setActiveIndex(value === null ? -1 : options.indexOf(value));
    setOpen(true);
    scrollActiveIntoView();
  };

  const selectOption = (option: T) => {
    onValueChange(option);
    closeList();
  };

  const moveActive = (step: number) => {
    if (options.length === 0) return;

    setActiveIndex((current) => {
      const next = current === -1 ? (step > 0 ? 0 : options.length - 1) : current + step;
      return Math.min(options.length - 1, Math.max(0, next));
    });
    scrollActiveIntoView();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    // Enter and Space are left to the button while the list is closed, so the
    // native activation opens it; once it is open they pick the active option.
    if (event.key === "Enter" || event.key === " ") {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        selectOption(options[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onBlur={closeList}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-1 pl-3 pr-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          SEGMENT_FOCUS_RING,
        )}
        {...aria}
      >
        <span
          className={cn(
            "truncate",
            value === null && "text-muted-foreground",
          )}
        >
          {value ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none size-4 shrink-0 text-muted-foreground"
        />
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
                  "flex h-9 cursor-pointer items-center rounded-sm px-3 text-sm text-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground",
                  option === value && "font-semibold",
                )}
              >
                {option}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export { OptionCombobox };
