import { type FormEvent, useId, useRef, useState } from "react";
import { CalendarClock, CalendarPlus, PencilLine } from "lucide-react";

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

interface EditTaskDialogProps {
  task: Task;
  tags: Tag[];
  onSave: (changes: TaskChanges) => void;
  onCreateTag: (values: TagValues) => Tag;
}

function EditTaskDialog({
  task,
  tags,
  onSave,
  onCreateTag,
}: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueAt, setDueAt] = useState(task.dueAt);
  const [tagIds, setTagIds] = useState(task.tagIds);
  const [error, setError] = useState("");
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const fieldId = useId();
  const dueFieldId = `${fieldId}-due`;
  const errorId = `${fieldId}-error`;

  const selectedTags = resolveTags(tagIds, toTagsById(tags));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitle(task.title);
      setDueAt(task.dueAt);
      setTagIds(task.tagIds);
      setError("");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle) {
      setError("Enter a task name.");
      return;
    }

    onSave({ title: nextTitle, dueAt, tagIds });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${task.title}`}
          title="Edit task"
        >
          <PencilLine aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, dialogTitleRef.current)
        }
      >
        <DialogHeader>
          <DialogTitle ref={dialogTitleRef} tabIndex={-1} className="focus:outline-none">
            Edit task
          </DialogTitle>
          <DialogDescription>
            Change the name, the due date, or the tags.
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
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { EditTaskDialog };
