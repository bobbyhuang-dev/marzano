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
  DialogClose,
  DialogContent,
  DialogDescription,
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
}

/**
 * The control that opens the picker. It is the same outline field as the due
 * date sitting beside it -- muted and icon-led while empty, so it reads as
 * optional -- and once filled it simply shows the tags, with the plus shrunk
 * to a marker at the end.
 */
const TagSelectTrigger = forwardRef<HTMLButtonElement, TagSelectTriggerProps>(
  ({ tags, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="outline"
      aria-label={
        tags.length === 0
          ? "Add tags"
          : `Tags: ${tags.map((tag) => tag.name).join(", ")}. Edit tags`
      }
      className={cn(
        // h-auto so the field keeps its shape once the chips wrap past a row.
        "h-auto w-full flex-wrap justify-start overflow-hidden px-3 py-2 font-normal",
        tags.length === 0 ? "text-muted-foreground" : "[&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {tags.length === 0 ? (
        <>
          <TagIcon aria-hidden="true" />
          <span className="truncate">Add tags</span>
        </>
      ) : (
        <>
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} size="md" />
          ))}
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground"
          >
            <Plus />
          </span>
        </>
      )}
    </Button>
  ),
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
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <DialogHeader className="shrink-0 p-5 pb-4 min-[420px]:p-6 min-[420px]:pb-4">
          <DialogTitle ref={titleRef} tabIndex={-1} className="focus:outline-none">
            Tags
          </DialogTitle>
          <DialogDescription>
            {tags.length === 0
              ? "Tags group tasks by subject, so you can find them together later."
              : "Pick as many as fit this task."}
          </DialogDescription>
        </DialogHeader>

        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-t border-border px-6 py-10 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <TagIcon className="size-5" aria-hidden="true" />
            </div>
            <p className="font-medium text-foreground">No tags yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Make one now and it is ready for every task after this.
            </p>
            <TagFormDialog
              tags={tags}
              onSubmit={handleCreate}
              trigger={
                <Button className="mt-5">
                  <Plus aria-hidden="true" />
                  New tag
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="shrink-0 border-y border-border bg-muted/35 p-4 min-[420px]:px-6">
              {tags.length >= SEARCH_THRESHOLD ? (
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={searchId}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a tag"
                    aria-label="Find a tag"
                    className="bg-background pl-9"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              ) : null}
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  tags.length >= SEARCH_THRESHOLD && "mt-2.5",
                )}
                aria-live="polite"
              >
                {draft.length === 0
                  ? "Nothing selected yet"
                  : `${draft.length} selected`}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {shown.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground min-[420px]:px-6">
                  No tag matches “{query.trim()}”.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {shown.map((tag) => {
                    const checked = draft.includes(tag.id);

                    return (
                      <li key={tag.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggle(tag.id)}
                          className="group flex min-h-11 w-full items-center gap-3 px-5 py-2.5 text-left transition-ui hover:bg-accent/50 outline-none focus-visible:bg-accent focus-visible:inset-ring-2 focus-visible:inset-ring-ring/70 min-[420px]:px-6"
                        >
                          <CheckboxIndicator checked={checked} />
                          <TagChip tag={tag} size="md" className="max-w-full" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="grid shrink-0 gap-2 border-t border-border p-5 min-[420px]:flex min-[420px]:items-center min-[420px]:justify-between min-[420px]:p-6">
          {tags.length === 0 ? (
            // With nothing to tick, saving a selection would mean nothing: the
            // only thing left to do here is leave.
            <DialogClose asChild>
              <Button variant="outline" className="min-[420px]:ml-auto">
                Close
              </Button>
            </DialogClose>
          ) : (
            <>
              <TagFormDialog
                tags={tags}
                onSubmit={handleCreate}
                trigger={
                  <Button variant="ghost">
                    <Plus aria-hidden="true" />
                    New tag
                  </Button>
                }
              />
              <div className="grid grid-cols-2 gap-2 min-[420px]:flex">
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { TagPickerDialog, TagSelectTrigger };
