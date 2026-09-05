import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex min-w-0 flex-col gap-5", className)}
      {...props}
    />
  );
}

function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel(props: ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" {...props} />;
}

function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-3", className)}
      {...props}
    />
  );
}

function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return (
    <legend
      data-slot="field-legend"
      className={cn("mb-3 text-sm font-medium", className)}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  );
}

export { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend, FieldError };
