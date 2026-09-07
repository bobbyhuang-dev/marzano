import { lazy, Suspense, useId, useState } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Most visits only need task names. Load the parser when a description is read.
const TaskMarkdown = lazy(() =>
  import("@/components/task-markdown").then((module) => ({
    default: module.TaskMarkdown,
  })),
);

type DescriptionMode = "write" | "preview";

const modes: SegmentedOption<DescriptionMode>[] = [
  { id: "write", label: "Write" },
  { id: "preview", label: "Preview" },
];

function MarkdownDescription({ source }: { source: string }) {
  if (!source.trim()) return null;
  return (
    <Suspense
      fallback={
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {source}
        </p>
      }
    >
      <TaskMarkdown source={source} />
    </Suspense>
  );
}

interface DescriptionModeToggleProps {
  mode: DescriptionMode;
  onModeChange: (mode: DescriptionMode) => void;
  className?: string;
  "aria-label"?: string;
}

/** The Write / Preview switch. Raised, because it sits beside the field it
 * drives and should not outshout it. */
function DescriptionModeToggle({
  mode,
  onModeChange,
  className,
  "aria-label": ariaLabel = "Description mode",
}: DescriptionModeToggleProps) {
  return (
    <SegmentedControl
      options={modes}
      value={mode}
      onValueChange={onModeChange}
      aria-label={ariaLabel}
      variant="raised"
      className={className}
    />
  );
}

interface DescriptionFieldProps {
  id?: string;
  mode: DescriptionMode;
  value: string;
  onChange: (value: string) => void;
  /** Applied to whichever box is showing, so the two keep one footprint. */
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * The box itself: the textarea in Write, the rendered note in Preview. The
 * placeholder is the only mention of Markdown -- a hint under the field said
 * the same thing twice.
 */
function DescriptionField({
  id,
  mode,
  value,
  onChange,
  className,
  ...labelling
}: DescriptionFieldProps) {
  if (mode === "write") {
    return (
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add details… Markdown supported"
        rows={4}
        className={className}
        {...labelling}
      />
    );
  }
  return (
    <div
      role="region"
      className={cn(
        "min-h-24 min-w-0 overflow-y-auto rounded-md border border-input p-3",
        className,
      )}
      {...labelling}
    >
      {value.trim() ? (
        <MarkdownDescription source={value} />
      ) : (
        <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
      )}
    </div>
  );
}

/**
 * The description as one field among others (the task form): a label, the
 * mode switch on the same line, and the box beneath. A dialog that is nothing
 * but the description composes the parts itself, since its title is the label.
 */
function DescriptionEditor({
  value,
  onChange,
  label = "Description",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<DescriptionMode>("write");
  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel id={`${id}-label`} htmlFor={id}>
          {label}
        </FieldLabel>
        <DescriptionModeToggle
          mode={mode}
          onModeChange={setMode}
          aria-label={`${label} mode`}
        />
      </div>
      <DescriptionField
        id={id}
        mode={mode}
        value={value}
        onChange={onChange}
        aria-labelledby={`${id}-label`}
      />
    </Field>
  );
}

export {
  MarkdownDescription,
  DescriptionEditor,
  DescriptionField,
  DescriptionModeToggle,
  type DescriptionMode,
};
