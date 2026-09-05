import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { CalendarClock, CalendarPlus, Plus } from "lucide-react";

import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { DescriptionEditor } from "@/components/markdown-description";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { SubtaskFields } from "@/components/subtask-fields";
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
import {
  createSubtask,
  formatDueDate,
  type Subtask,
  type Task,
} from "@/lib/tasks";
import { resolveTags, tagsById as toTagsById, type Tag } from "@/lib/tags";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";

export interface TaskChanges {
  title: string;
  dueAt: string | null;
  tagIds: string[];
  description: string;
  subtasks: Subtask[];
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
  const [description, setDescription] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [invalidSubtaskId, setInvalidSubtaskId] = useState<string | null>(null);
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
      setDescription(task?.description ?? "");
      setSubtasks(task?.subtasks ?? []);
      setInvalidSubtaskId(null);
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
      (
        event.currentTarget.elements.namedItem("title") as HTMLInputElement
      )?.focus();
      return;
    }

    const invalidSubtask = subtasks.find((subtask) => !subtask.title.trim());
    if (invalidSubtask) {
      setInvalidSubtaskId(invalidSubtask.id);
      (
        event.currentTarget.elements.namedItem(
          `subtask-${invalidSubtask.id}`,
        ) as HTMLInputElement
      )?.focus();
      return;
    }

    onSubmit({
      title: nextTitle,
      dueAt,
      tagIds,
      description,
      subtasks: subtasks.map((subtask) => ({
        ...subtask,
        title: subtask.title.trim(),
      })),
    });
    setOpen(false);
  };

  const updateSubtask = (id: string, changes: Partial<Subtask>) => {
    setSubtasks((current) =>
      current.map((subtask) =>
        subtask.id === id ? { ...subtask, ...changes } : subtask,
      ),
    );
    if (changes.title !== undefined && invalidSubtaskId === id)
      setInvalidSubtaskId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 md:max-w-[56rem]"
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, dialogTitleRef.current)
        }
      >
        <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
          <DialogHeader className="shrink-0 p-4 pr-14 min-[420px]:p-6 min-[420px]:pr-16">
            <DialogTitle
              ref={dialogTitleRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
              {editing ? "Edit task" : "New task"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details or break the work into smaller steps."
                : "Name it, add details, and break it into smaller steps."}
            </DialogDescription>
          </DialogHeader>
          {/* Like the due-date picker, only the middle scrolls. Wide screens
              put the checklist beside the details instead of below them. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
            <div className="md:grid md:grid-cols-2">
              <FieldGroup className="p-4 min-[420px]:p-6">
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor={fieldId}>Task name</FieldLabel>
                  <Input
                    id={fieldId}
                    name="title"
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
                  {error ? <FieldError id={errorId}>{error}</FieldError> : null}
                </Field>
                {open ? (
                  <DescriptionEditor
                    value={description}
                    onChange={setDescription}
                  />
                ) : null}
                <Field>
                  <FieldLabel htmlFor={dueFieldId}>Due date</FieldLabel>
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
                </Field>
                <TagPickerDialog
                  tags={tags}
                  value={tagIds}
                  onValueChange={setTagIds}
                  onCreateTag={onCreateTag}
                  trigger={<TagSelectTrigger tags={selectedTags} />}
                />
              </FieldGroup>
              <FieldGroup className="border-t border-border p-4 min-[420px]:p-6 md:border-l md:border-t-0">
                <FieldSet>
                  <FieldLegend>Subtasks</FieldLegend>
                  {subtasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Break this task into small, checkable steps.
                    </p>
                  ) : null}
                  {subtasks.map((subtask, index) => (
                    <SubtaskFields
                      key={subtask.id}
                      subtask={subtask}
                      index={index}
                      idPrefix={fieldId}
                      invalid={invalidSubtaskId === subtask.id}
                      onChange={(changes) => updateSubtask(subtask.id, changes)}
                      onDelete={() =>
                        setSubtasks((current) =>
                          current.filter((item) => item.id !== subtask.id),
                        )
                      }
                    />
                  ))}
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={() =>
                      setSubtasks((current) => [...current, createSubtask()])
                    }
                  >
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Add subtask
                  </Button>
                </FieldSet>
              </FieldGroup>
            </div>
          </div>
          <DialogFooter className="grid shrink-0 grid-cols-2 p-4 min-[420px]:p-6 sm:flex">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">
              {editing ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { TaskFormDialog };
