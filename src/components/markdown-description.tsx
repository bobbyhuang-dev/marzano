import { lazy, Suspense, useId, useState } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";

// Most visits only need task names. Load the parser when a description is read.
const TaskMarkdown = lazy(() =>
  import("@/components/task-markdown").then((module) => ({
    default: module.TaskMarkdown,
  })),
);
const modes = [
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
  const [mode, setMode] = useState("write");
  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel id={`${id}-label`} htmlFor={id}>
          {label}
        </FieldLabel>
        <SegmentedControl
          options={modes}
          value={mode}
          onValueChange={setMode}
          aria-label={`${label} mode`}
          variant="raised"
        />
      </div>
      {mode === "write" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add details… Markdown supported"
          rows={4}
          aria-describedby={`${id}-hint`}
        />
      ) : (
        <div
          role="region"
          aria-labelledby={`${id}-label`}
          className="min-h-28 min-w-0 rounded-md border border-input p-3"
        >
          {value.trim() ? (
            <MarkdownDescription source={value} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Optional · Supports Markdown
      </p>
    </Field>
  );
}

export { MarkdownDescription, DescriptionEditor };
