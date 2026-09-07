import {
  forwardRef,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { FileText, TextAlignStart } from "lucide-react";

import {
  DescriptionField,
  DescriptionModeToggle,
  type DescriptionMode,
} from "@/components/markdown-description";
import { Button } from "@/components/ui/button";
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
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

interface DescriptionSelectTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The description drafted so far. */
  description: string;
  /** `chip` is the small pill under the task page's composer. */
  variant?: "field" | "chip";
}

/** The first line with anything on it: what a reader would call the note. */
function firstLine(description: string): string {
  return (
    description
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * The control that opens the dialog: the same outline field as the due date,
 * the tags and the subtasks beside it, muted while empty and showing the
 * opening line once filled, so the chip says what was written without the
 * whole note spilling under the composer.
 */
const DescriptionSelectTrigger = forwardRef<
  HTMLButtonElement,
  DescriptionSelectTriggerProps
>(({ description, variant = "field", className, ...props }, ref) => {
  const chip = variant === "chip";
  const summary = firstLine(description);
  const empty = summary === "";

  return (
    <Button
      ref={ref}
      variant="outline"
      size={chip ? "sm" : "default"}
      aria-label={empty ? "Add description" : "Edit description"}
      className={cn(
        "max-w-full justify-start overflow-hidden font-normal",
        chip ? "rounded-full" : "w-full px-3",
        // A filled chip is capped so a long first line cannot take the row.
        chip && !empty && "max-w-72",
        empty && "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {empty ? (
        <TextAlignStart aria-hidden="true" />
      ) : (
        <FileText aria-hidden="true" />
      )}
      <span className="truncate">
        {empty ? (chip ? "Description" : "Add description") : summary}
      </span>
    </Button>
  );
});
DescriptionSelectTrigger.displayName = "DescriptionSelectTrigger";

interface DescriptionPickerDialogProps {
  trigger: ReactNode;
  value: string;
  onValueChange: (description: string) => void;
}

/**
 * Where the quick-add form writes the longer note. Like the tag and subtask
 * pickers it edits a copy and hands it back on save, so cancelling costs
 * nothing.
 *
 * The dialog is the field: its title is the label, so the box has no second
 * heading, and the Write / Preview switch sits in the footer where the subtask
 * dialog keeps its own secondary action. The box scrolls itself, so the body
 * never has to.
 */
function DescriptionPickerDialog({
  trigger,
  value,
  onValueChange,
}: DescriptionPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<DescriptionMode>("write");
  const titleRef = useRef<HTMLHeadingElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(value);
      // Every visit starts on Write: the note is opened to be edited.
      setMode("write");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Portalled away, but React still bubbles this to the form that renders
    // the trigger, which would add the task itself.
    event.stopPropagation();
    onValueChange(draft.trim() ? draft : "");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="max-w-xl"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, titleRef.current)
        }
      >
        <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
              Description
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <DescriptionField
              mode={mode}
              value={draft}
              onChange={setDraft}
              aria-label="Description"
              className="max-h-[50dvh] min-h-40 field-sizing-content resize-none"
            />
          </DialogBody>

          <DialogFooter>
            <DescriptionModeToggle
              mode={mode}
              onModeChange={setMode}
              className="mr-auto"
            />
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save description</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DescriptionPickerDialog, DescriptionSelectTrigger };
