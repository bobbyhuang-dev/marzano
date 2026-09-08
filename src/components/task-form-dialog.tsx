import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { CalendarClock, CalendarPlus, Plus } from "lucide-react";

import { DueDatePickerDialog } from "@/components/due-date-picker-dialog";
import { DuePhraseInput } from "@/components/due-phrase-input";
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
import { TagMentionMenu } from "@/components/tag-mention-menu";
import {
  TagPickerDialog,
  TagSelectTrigger,
} from "@/components/tag-picker-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createSubtask,
  formatDueDate,
  type Subtask,
  type Task,
} from "@/lib/tasks";
import { resolveTags, tagsById as toTagsById, type Tag } from "@/lib/tags";
import { cn, focusDialogTitleOnTouch } from "@/lib/utils";
import { useDuePhrase } from "@/hooks/use-due-phrase";
import { useTagMention } from "@/hooks/use-tag-mention";

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
  // One field for the name and its due date, as on the task page: a date
  // typed into the name is the due date until a date is picked instead.
  const draft = useDuePhrase();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [invalidSubtaskId, setInvalidSubtaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const mention = useTagMention({
    tags,
    value: draft.title,
    onValueChange: draft.setTitle,
    onPick: (tag) =>
      setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id])),
    inputRef: titleInputRef,
  });
  const fieldId = useId();
  const dueFieldId = `${fieldId}-due`;
  const errorId = `${fieldId}-error`;

  const editing = task !== undefined;
  const selectedTags = resolveTags(tagIds, toTagsById(tags));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      draft.reset(task?.title ?? "", task ? task.dueAt : defaultDueAt);
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

    const nextTitle = draft.cleanTitle;

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
      dueAt: draft.dueAt,
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
        className="max-w-xl md:max-w-[56rem]"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) =>
          focusDialogTitleOnTouch(event, dialogTitleRef.current)
        }
        // Radix hears Escape on the document before the field does, so the
        // tag list has to claim it here or the whole dialog would close.
        onEscapeKeyDown={(event) => {
          if (mention.open) event.preventDefault();
        }}
      >
        <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle
              ref={dialogTitleRef}
              tabIndex={-1}
              className="focus:outline-none"
            >
              {editing ? "Edit task" : "New task"}
            </DialogTitle>
          </DialogHeader>
          {/* Wide screens put the checklist beside the details instead of
              below them; the gap between the columns is the only divider. */}
          <DialogBody>
            <div className="grid gap-6 md:grid-cols-2 md:gap-x-10">
              <FieldGroup>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor={fieldId}>Task name</FieldLabel>
                  <DuePhraseInput
                    {...mention.inputProps}
                    ref={titleInputRef}
                    id={fieldId}
                    name="title"
                    value={draft.title}
                    phrase={draft.phrase}
                    mention={mention.mention}
                    onChange={(event) => {
                      mention.inputProps.onChange(event);
                      if (error) setError("");
                    }}
                    placeholder={
                      editing
                        ? undefined
                        : tags.length > 0
                          ? "What needs doing? Type # to add a tag"
                          : "What needs doing?"
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore
                  >
                    <TagMentionMenu field={mention} />
                  </DuePhraseInput>
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
                    value={draft.dueAt}
                    onValueChange={draft.setDueAt}
                    title={draft.dueAt ? "Change due date" : "Add due date"}
                    trigger={
                      <Button
                        id={dueFieldId}
                        variant="outline"
                        className={cn(
                          "w-full justify-start overflow-hidden px-3 font-normal",
                          draft.dueAt
                            ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
                            : "text-muted-foreground",
                        )}
                      >
                        {draft.dueAt ? (
                          <CalendarClock aria-hidden="true" />
                        ) : (
                          <CalendarPlus aria-hidden="true" />
                        )}
                        <span className="truncate tabular-nums">
                          {draft.dueAt ? formatDueDate(draft.dueAt) : "Add due date"}
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
              <FieldGroup>
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
                    size="sm"
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
          </DialogBody>
          <DialogFooter>
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
