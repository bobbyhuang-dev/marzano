import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type Subtask } from "@/lib/tasks";

interface SubtaskFieldsProps {
  subtask: Subtask;
  /** Zero-based position in its list, for the labels a screen reader hears. */
  index: number;
  /** Prefix that keeps the field ids unique per form. */
  idPrefix: string;
  invalid: boolean;
  onChange: (changes: Partial<Subtask>) => void;
  onDelete: () => void;
}

/**
 * One editable subtask -- name and done state --
 * shared by the task dialog and the quick-add form on the task page, so a
 * subtask is written the same way wherever the task is.
 */
function SubtaskFields({
  subtask,
  index,
  idPrefix,
  invalid,
  onChange,
  onDelete,
}: SubtaskFieldsProps) {
  const fieldId = `${idPrefix}-${subtask.id}`;
  const errorId = `${fieldId}-error`;

  return (
    <FieldGroup className="gap-3 rounded-md border border-border p-3">
      <div className="flex items-start gap-1">
        <Checkbox
          checked={subtask.completedAt !== null}
          onCheckedChange={(checked) =>
            onChange({
              completedAt: checked ? new Date().toISOString() : null,
            })
          }
          aria-label={`Mark subtask ${index + 1} as ${subtask.completedAt ? "incomplete" : "complete"}`}
        />
        <Field className="flex-1" data-invalid={invalid}>
          <FieldLabel className="sr-only" htmlFor={fieldId}>
            Subtask {index + 1} name
          </FieldLabel>
          <Input
            id={fieldId}
            name={`subtask-${subtask.id}`}
            value={subtask.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="What is the next step?"
            autoFocus={!subtask.title}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            data-lpignore="true"
            data-1p-ignore
          />
          {invalid ? (
            <FieldError id={errorId}>Enter a subtask name.</FieldError>
          ) : null}
        </Field>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete subtask ${index + 1}`}
          title="Delete subtask"
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </FieldGroup>
  );
}

export { SubtaskFields };
