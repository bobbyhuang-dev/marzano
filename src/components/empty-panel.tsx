import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

/** What a list shows in place of rows, so every empty list looks alike. */
function EmptyPanel({ icon: Icon, title, description, action }: EmptyPanelProps) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 py-8 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { EmptyPanel };
