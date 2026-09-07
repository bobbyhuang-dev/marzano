import {
  forwardRef,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { ListChecks, ListPlus, Plus } from "lucide-react";

import { SubtaskFields } from "@/components/subtask-fields";
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
import { createSubtask, type Subtask } from "@/lib/tasks";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

interface SubtaskSelectTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The subtasks drafted so far. */
  subtasks: Subtask[];
  /** `chip` is the small pill under the task page's composer. */
  variant?: "field" | "chip";
}

/**
 * The control that opens the dialog: the same outline field as the due date
 * and the tags beside it, muted while empty and showing the count once filled.
 */
const SubtaskSelectTrigger = forwardRef<
  HTMLButtonElement,
  SubtaskSelectTriggerProps
>(({ subtasks, variant = "field", className, ...props }, ref) => {
  const chip = variant === "chip";
  const count = subtasks.length;
  const label = count === 1 ? "1 subtask" : `${count} subtasks`;

  return (
    <Button
      ref={ref}
      variant="outline"
      size={chip ? "sm" : "default"}
      aria-label={count === 0 ? "Add subtasks" : `${label}. Edit subtasks`}
      className={cn(
        "max-w-full justify-start overflow-hidden font-normal",
        chip ? "rounded-full" : "w-full px-3",
        count === 0 && "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {count === 0 ? (
        <ListPlus aria-hidden="true" />
      ) : (
        <ListChecks aria-hidden="true" />
      )}
      <span className="truncate tabular-nums">
        {count === 0 ? (chip ? "Subtasks" : "Add subtasks") : label}
      </span>
    </Button>
  );
});
SubtaskSelectTrigger.displayName = "SubtaskSelectTrigger";

interface SubtaskPickerDialogProps {
  trigger: ReactNode;
  value: Subtask[];
  onValueChange: (subtasks: Subtask[]) => void;
}

/**
 * Where the quick-add form breaks a task into steps. Like the tag picker it
 * edits a copy and hands it back on save, so cancelling costs nothing.
 */
function SubtaskPickerDialog({
  trigger,
  value,
  onValueChange,
}: SubtaskPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Subtask[]>(value);
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(value);
      setInvalidId(null);
    }
  };

  const updateSubtask = (id: string, changes: Partial<Subtask>) => {
    setDraft((current) =>
      current.map((subtask) =>
        subtask.id === id ? { ...subtask, ...changes } : subtask,
      ),
    );
    if (changes.title !== undefined && invalidId === id) setInvalidId(null);
  };

  const removeSubtask = (id: string) => {
    setDraft((current) => current.filter((subtask) => subtask.id !== id));
    if (invalidId === id) setInvalidId(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Portalled away, but React still bubbles this to the form that renders
    // the trigger, which would add the task itself.
    event.stopPropagation();

    const invalid = draft.find((subtask) => !subtask.title.trim());
    if (invalid) {
      setInvalidId(invalid.id);
      (
        event.currentTarget.elements.namedItem(
          `subtask-${invalid.id}`,
        ) as HTMLInputElement | null
      )?.focus();
      return;
    }

    onValueChange(
      draft.map((subtask) => ({ ...subtask, title: subtask.title.trim() })),
    );
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
              Subtasks
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            {draft.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-3 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ListChecks className="size-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-foreground">No subtasks yet</p>
                <p className="mt-0.5 max-w-xs text-balance text-sm text-muted-foreground">
                  Each step gets its own checkbox on the task.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2" aria-label="Subtasks">
                {draft.map((subtask, index) => (
                  <li key={subtask.id}>
                    <SubtaskFields
                      subtask={subtask}
                      index={index}
                      idPrefix={fieldId}
                      invalid={invalidId === subtask.id}
                      onChange={(changes) => updateSubtask(subtask.id, changes)}
                      onDelete={() => removeSubtask(subtask.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                setDraft((current) => [...current, createSubtask()])
              }
            >
              <Plus aria-hidden="true" />
              Add subtask
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save subtasks</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { SubtaskPickerDialog, SubtaskSelectTrigger };
