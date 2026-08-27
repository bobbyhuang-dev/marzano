import { useCallback, useId, useRef, useState } from "react";
import { Check, ChevronDown, Tags, X } from "lucide-react";

import { TagSwatch } from "@/components/tag-chip";
import { Button } from "@/components/ui/button";
import { useMenuDismiss } from "@/hooks/use-menu-dismiss";
import type { TagTaskCount } from "@/lib/tasks";
import { byTagName, type Tag } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** Beyond this the trigger counts tags instead of naming them. */
const MAX_TRIGGER_DOTS = 3;

interface TagFilterMenuProps {
  tags: Tag[];
  selected: string[];
  onSelectedChange: (tagIds: string[]) => void;
  /** Task counts per tag, so the list says what each filter is worth. */
  counts: Map<string, TagTaskCount>;
  onManageTags: () => void;
}

/**
 * The filter above the task list. Tag names run to any length, so the trigger
 * never tries to spell out a selection: one tag shows its name truncated, more
 * than one collapses to its colours and a count, and the full names live in the
 * list below, where a row can afford to be a row.
 */
function TagFilterMenu({
  tags,
  selected,
  onSelectedChange,
  counts,
  onManageTags,
}: TagFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const sorted = [...tags].sort(byTagName);
  const active = sorted.filter((tag) => selected.includes(tag.id));

  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss({
    open,
    container: containerRef,
    trigger: triggerRef,
    onClose: close,
  });

  const toggle = (tagId: string) => {
    onSelectedChange(
      selected.includes(tagId)
        ? selected.filter((id) => id !== tagId)
        : [...selected, tagId],
    );
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="true"
        className="inline-flex h-11 min-h-11 max-w-full items-center gap-2 rounded-full border border-input bg-background px-3.5 text-sm font-normal text-muted-foreground shadow-sm transition-[color,background-color,border-color,box-shadow] duration-150 ease-out hover:bg-accent hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70"
      >
        <Tags aria-hidden="true" className="size-4 shrink-0" />
        {active.length > 0 ? (
          <>
            <span aria-hidden="true" className="flex shrink-0 -space-x-1">
              {active.slice(0, MAX_TRIGGER_DOTS).map((tag) => (
                <TagSwatch
                  key={tag.id}
                  color={tag.color}
                  className="size-3 ring-2 ring-background"
                />
              ))}
            </span>
            <span className="truncate">
              {active.length === 1 ? active[0].name : `${active.length} tags`}
            </span>
          </>
        ) : (
          <span className="truncate">Filter by tag</span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-180",
          )}
        />
      </button>

      {active.length > 0 ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-10 min-h-10 min-w-10 shrink-0 text-muted-foreground"
          aria-label="Clear tag filter"
          title="Clear tag filter"
          onClick={() => onSelectedChange([])}
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label="Filter by tag"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2.5rem))] origin-top-left animate-popover-in overflow-hidden rounded-lg bg-popover shadow-popover"
        >
          {sorted.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-foreground">No tags yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tags you create show up here to filter by.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setOpen(false);
                  onManageTags();
                }}
              >
                Go to Tags
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="px-1 text-xs font-medium text-muted-foreground">
                  {selected.length > 0
                    ? `${selected.length} of ${sorted.length} selected`
                    : "Show only these tags"}
                </span>
                {selected.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectedChange([])}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-150 ease-out hover:bg-accent hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <ul className="max-h-[17rem] overflow-y-auto overscroll-contain py-1">
                {sorted.map((tag) => {
                  const checked = selected.includes(tag.id);
                  const open = counts.get(tag.id)?.open ?? 0;

                  return (
                    <li key={tag.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(tag.id)}
                        className="flex min-h-10 w-full items-center gap-2.5 px-3 text-left text-sm transition-[color,background-color,border-color,box-shadow] duration-150 ease-out hover:bg-accent/60 outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/70"
                      >
                        <TagSwatch color={tag.color} className="size-3.5" />
                        <span
                          title={tag.name}
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            checked ? "font-medium text-foreground" : "text-foreground/85",
                          )}
                        >
                          {tag.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {open}
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
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { TagFilterMenu };
