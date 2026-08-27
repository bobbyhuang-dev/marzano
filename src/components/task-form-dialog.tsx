import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { CalendarClock, CalendarPlus } from "lucide-react";

import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { type TagValues } from "@/components/tag-form-dialog";
import {
  TagPickerDialog,
  TagSelectTrigger,
} from "@/components/tag-picker-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDueDate, type Task } from "@/lib/tasks";
import { resolveTags, tagsById as toTagsById, type Tag } from "@/lib/tags";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

export interface TaskChanges {
  title: string;
  dueAt: string | null;
  tagIds: string[];
}

interface TaskFormDialogProps {
  trigger: ReactNode;
  tags: Tag[];
  /** The task being edited; omitted when creating a new one. */
  task?: Task;
  /** What a new task starts out due on, so a day can hand over its own date. */
  defaultDueAt?: string | null;
  onSubmit: (values: TaskChanges) => void;
  onCreateTag: (values: TagValues) => Tag;
}

/**
 * One window for both writing and editing a task, like the tag form beside it.
 * The task page keeps its own inline form -- typing a name and pressing enter is
 * the fastest way to add one -- so this is for the places a task is written
 * somewhere other than the top of a list.
 */
function TaskFormDialog({
  trigger,
  tags,
  task,
  defaultDueAt = null,
  onSubmit,
  onCreateTag,
}: TaskFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();
  const dueFieldId = `${fieldId}-due`;
  const errorId = `${fieldId}-error`;

  const editing = task !== undefined;
  const selectedTags = resolveTags(tagIds, toTagsById(tags));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitle(task?.title ?? "");
      setDueAt(task ? task.dueAt : defaultDueAt);
      setTagIds(task?.tagIds ?? []);
      setError("");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // The dialog is portalled away, but React still bubbles this submit to the
    // form that renders the trigger, which would submit that form too.
    event.stopPropagation();

    const nextTitle = title.trim();

    if (!nextTitle) {
      setError("Enter a task name.");
      return;
    }

    onSubmit({ title: nextTitle, dueAt, tagIds });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, dialogTitleRef.current)
        }
      >
        <DialogHeader>
          <DialogTitle ref={dialogTitleRef} tabIndex={-1} className="focus:outline-none">
            {editing ? "Edit task" : "New task"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the name, the due date, or the tags."
              : "Name it, then check the date and add any tags."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={fieldId}>Task name</Label>
            <Input
              id={fieldId}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (error) setError("");
              }}
              placeholder={editing ? undefined : "What needs doing?"}
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
          <div className="grid gap-2">
            <Label htmlFor={dueFieldId}>Due date</Label>
            <DueDatePickerDialog
              value={dueAt}
              onValueChange={setDueAt}
              title={dueAt ? "Change due date" : "Add due date"}
              trigger={
                <Button
                  id={dueFieldId}
                  variant="outline"
                  className={cn(
                    "w-full justify-start overflow-hidden px-3 font-normal",
                    !dueAt && "text-muted-foreground",
                  )}
                >
                  {dueAt ? (
                    <CalendarClock aria-hidden="true" />
                  ) : (
                    <CalendarPlus aria-hidden="true" />
                  )}
                  <span className="truncate tabular-nums">
                    {dueAt ? formatDueDate(dueAt) : "Add due date"}
                  </span>
                </Button>
              }
            />
          </div>
          <TagPickerDialog
            tags={tags}
            value={tagIds}
            onValueChange={setTagIds}
            onCreateTag={onCreateTag}
            trigger={<TagSelectTrigger tags={selectedTags} />}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">{editing ? "Save changes" : "Add task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { TaskFormDialog };
