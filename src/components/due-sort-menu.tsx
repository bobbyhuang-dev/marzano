import { useCallback, useId, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowUpDown,
  Check,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

import { useMenuDismiss } from "@/hooks/use-menu-dismiss";
import type { DueSort } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface SortOption {
  id: DueSort;
  /** What the trigger says once this option is picked. */
  label: string;
  /** What the row in the menu says, phrased as the order it produces. */
  description: string;
  icon: LucideIcon;
}

const SORT_OPTIONS: SortOption[] = [
  {
    id: "default",
    label: "Sort by date",
    description: "The order you added them in",
    icon: ArrowUpDown,
  },
  {
    id: "asc",
    label: "Earliest first",
    description: "Soonest deadline at the top",
    icon: ArrowUpNarrowWide,
  },
  {
    id: "desc",
    label: "Latest first",
    description: "Furthest deadline at the top",
    icon: ArrowDownWideNarrow,
  },
];

interface DueSortMenuProps {
  value: DueSort;
  onValueChange: (sort: DueSort) => void;
}

/**
 * Orders the task list by due date. Built like the tag filter beside it -- the
 * same pill, the same panel -- but the options exclude each other, so the rows
 * are radios and the menu closes on the one that was picked.
 */
function DueSortMenu({ value, onValueChange }: DueSortMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss({
    open,
    container: containerRef,
    trigger: triggerRef,
    onClose: close,
  });

  const active = SORT_OPTIONS.find((option) => option.id === value) ?? SORT_OPTIONS[0];
  const ActiveIcon = active.icon;

  const select = (sort: DueSort) => {
    onValueChange(sort);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="true"
        className="inline-flex h-11 min-h-11 max-w-full items-center gap-2 rounded-full border border-input bg-background px-3.5 text-sm font-medium text-muted-foreground shadow-sm ring-offset-background transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ActiveIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{active.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="radiogroup"
          aria-label="Sort by due date"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2.5rem))] origin-top-left animate-popover-in overflow-hidden rounded-lg bg-popover shadow-popover"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="px-1 text-xs font-medium text-muted-foreground">
              Sort by due date
            </span>
          </div>
          <ul className="py-1">
            {SORT_OPTIONS.map((option) => {
              const checked = option.id === value;
              const OptionIcon = option.icon;

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => select(option.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ring-inset ring-offset-background transition-colors duration-150 ease-out hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <OptionIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate",
                          checked ? "font-medium text-foreground" : "text-foreground/85",
                        )}
                      >
                        {option.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                    <Check
                      aria-hidden="true"
                      strokeWidth={3}
                      className={cn(
                        "size-4 shrink-0 text-foreground transition-opacity duration-150 ease-out",
                        checked ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { DueSortMenu, SORT_OPTIONS };
