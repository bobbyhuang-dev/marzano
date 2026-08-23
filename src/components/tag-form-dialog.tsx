import {
  type FormEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";

import { TagChip } from "@/components/tag-chip";
import { TagColorPicker } from "@/components/tag-color-picker";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  isTagNameTaken,
  MAX_TAG_NAME_LENGTH,
  suggestTagColor,
  tagColorName,
  type Tag,
} from "@/lib/tags";
import { focusDialogTitleOnTouch } from "@/lib/utils";

export interface TagValues {
  name: string;
  color: string;
}

interface TagFormDialogProps {
  trigger: ReactNode;
  /** Every tag, so a name cannot be used twice and a fresh colour can be picked. */
  tags: Tag[];
  /** The tag being edited; omitted when creating a new one. */
  tag?: Tag;
  onSubmit: (values: TagValues) => void;
}

/**
 * One window for both creating and editing a tag: a live preview of the chip,
 * the name, and the palette. The preview stays pinned above the scrolling
 * fields, so picking a colour always shows what it will look like.
 */
function TagFormDialog({ trigger, tags, tag, onSubmit }: TagFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(() => suggestTagColor(tags));
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const paletteId = `${fieldId}-palette`;

  const editing = tag !== undefined;
  const trimmed = name.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setName(tag?.name ?? "");
      setColor(tag?.color ?? suggestTagColor(tags));
      setError("");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portalled away, but React still bubbles this submit to the
    // form that renders the trigger, which would submit that form too.
    event.stopPropagation();

    if (!trimmed) {
      setError("Enter a tag name.");
      return;
    }

    if (isTagNameTaken(tags, trimmed, tag?.id)) {
      setError(`You already have a tag called “${trimmed}”.`);
      return;
    }

    onSubmit({ name: trimmed, color });
    setOpen(false);
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
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogHeader className="shrink-0 p-5 pb-4 min-[420px]:p-6 min-[420px]:pb-4">
            <DialogTitle ref={titleRef} tabIndex={-1} className="focus:outline-none">
              {editing ? "Edit tag" : "New tag"}
            </DialogTitle>
            <DialogDescription>
              Name it, then give it a colour you will recognise.
            </DialogDescription>
          </DialogHeader>

          {/* Pinned between the header and the scrolling fields: whatever the
              palette is doing, the result of it stays on screen. */}
          <div className="flex shrink-0 items-center justify-center border-y border-border bg-muted/35 px-5 py-5">
            <TagChip
              tag={{ id: "preview", name: trimmed || "Tag name", color }}
              size="lg"
              className="max-w-full"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid gap-5 p-5 min-[420px]:p-6">
              <div className="grid gap-2">
                <Label htmlFor={fieldId}>Name</Label>
                <Input
                  id={fieldId}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="School, Errands, Reading…"
                  maxLength={MAX_TAG_NAME_LENGTH}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore
                />
                {error ? (
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span id={paletteId} className="text-sm font-medium leading-none">
                    Colour
                  </span>
                  <span
                    className="truncate text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {tagColorName(color)}
                  </span>
                </div>
                <TagColorPicker
                  value={color}
                  onValueChange={setColor}
                  aria-label="Tag colour"
                  aria-describedby={paletteId}
                />
              </div>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-5 min-[420px]:flex min-[420px]:justify-end min-[420px]:p-6">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">{editing ? "Save changes" : "Create tag"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { TagFormDialog };
