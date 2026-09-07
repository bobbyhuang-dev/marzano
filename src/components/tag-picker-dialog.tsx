import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Plus, Search, Tag as TagIcon } from "lucide-react";

import { TagChip } from "@/components/tag-chip";
import { TagFormDialog, type TagValues } from "@/components/tag-form-dialog";
import { Button } from "@/components/ui/button";
import { CheckboxIndicator } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { byTagName, type Tag } from "@/lib/tags";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

/** Below this many tags the list is easier to scan than to search. */
const SEARCH_THRESHOLD = 7;

interface TagSelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The tags currently on the task, already resolved and ordered. */
  tags: Tag[];
  /**
   * `field` is the full-width control a form lays out in a column; `chip` is
   * the small pill the task page keeps under its one-line composer.
   */
  variant?: "field" | "chip";
}

/**
 * The control that opens the picker. It is the same outline field as the due
 * date sitting beside it -- muted and icon-led while empty, so it reads as
 * optional -- and once filled it simply shows the tags, with the plus shrunk
 * to a marker at the end.
 */
const TagSelectTrigger = forwardRef<HTMLButtonElement, TagSelectTriggerProps>(
  ({ tags, variant = "field", className, ...props }, ref) => {
    const chip = variant === "chip";

    return (
      <Button
        ref={ref}
        variant="outline"
        size={chip ? "sm" : "default"}
        aria-label={
          tags.length === 0
            ? "Add tags"
            : `Tags: ${tags.map((tag) => tag.name).join(", ")}. Edit tags`
        }
        className={cn(
          // h-auto so the field keeps its shape once the chips wrap past a row.
          "h-auto max-w-full flex-wrap justify-start overflow-hidden font-normal",
          chip ? "min-h-8 rounded-full py-1 pointer-coarse:min-h-9" : "w-full px-3 py-1.5",
          tags.length === 0 ? "text-muted-foreground" : "[&_svg]:size-3.5",
          className,
        )}
        {...props}
      >
        {tags.length === 0 ? (
          <>
            <TagIcon aria-hidden="true" />
            <span className="truncate">{chip ? "Tags" : "Add tags"}</span>
          </>
        ) : (
          <>
            {tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} size={chip ? "sm" : "md"} />
            ))}
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground"
            >
              <Plus />
            </span>
          </>
        )}
      </Button>
    );
  },
);
TagSelectTrigger.displayName = "TagSelectTrigger";

interface TagPickerDialogProps {
  trigger: ReactNode;
  tags: Tag[];
  value: string[];
  onValueChange: (tagIds: string[]) => void;
  /** Creates the tag app-wide and hands it back so it can be ticked here. */
  onCreateTag: (values: TagValues) => Tag;
}

/**
 * Picks the tags on a task. Tags created from here are saved straight away and
 * come back ticked, so a missing tag never costs the user their place.
 */
function TagPickerDialog({
  trigger,
  tags,
  value,
  onValueChange,
  onCreateTag,
}: TagPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const searchId = useId();

  const sorted = [...tags].sort(byTagName);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? sorted.filter((tag) => tag.name.toLowerCase().includes(needle))
    : sorted;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraft(value);
      setQuery("");
    }
  };

  const toggle = (tagId: string) => {
    setDraft((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  };

  const handleCreate = (values: TagValues) => {
    const created = onCreateTag(values);

    setQuery("");
    setDraft((current) => [...current, created.id]);
    return created;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="focus:outline-none">
            Tags
          </DialogTitle>
        </DialogHeader>

        {tags.length === 0 ? (
          // With nothing to tick there is no footer: the X, Escape and the
          // overlay already leave, and a Close button would only repeat them.
          <div className="flex flex-col items-center justify-center px-5 pt-5 pb-8 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <TagIcon className="size-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">No tags yet</p>
            <p className="mt-0.5 max-w-xs text-balance text-sm text-muted-foreground">
              Make one now and it is ready for every task after this.
            </p>
            <TagFormDialog
              tags={tags}
              onSubmit={handleCreate}
              trigger={
                <Button className="mt-4">
                  <Plus aria-hidden="true" />
                  New tag
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* The search stays put above the list; only the list scrolls. */}
            {tags.length >= SEARCH_THRESHOLD ? (
              <div className="relative shrink-0 px-5 py-2">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-8 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id={searchId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a tag"
                  aria-label="Find a tag"
                  className="pl-9"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}

            {/* Rows are rounded and inset from the gutter like a menu's, so the
                list needs no dividers: the hover and the tick mark the row. */}
            <DialogBody className="px-3">
              {shown.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No tag matches “{query.trim()}”.
                </p>
              ) : (
                <ul className="grid gap-0.5">
                  {shown.map((tag) => {
                    const checked = draft.includes(tag.id);

                    return (
                      <li key={tag.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggle(tag.id)}
                          className="group flex min-h-9 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-ui hover:bg-accent/50 outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/70 pointer-coarse:min-h-10"
                        >
                          <CheckboxIndicator checked={checked} />
                          <TagChip tag={tag} size="md" className="max-w-full" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DialogBody>
            <p className="sr-only" aria-live="polite">
              {draft.length === 0
                ? "Nothing selected"
                : `${draft.length} selected`}
            </p>
          </>
        )}

        {tags.length > 0 ? (
          <DialogFooter>
            <TagFormDialog
              tags={tags}
              onSubmit={handleCreate}
              trigger={
                <Button variant="ghost" className="mr-auto">
                  <Plus aria-hidden="true" />
                  New tag
                </Button>
              }
            />
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                onValueChange(draft);
                setOpen(false);
              }}
            >
              Save tags
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { TagPickerDialog, TagSelectTrigger };
