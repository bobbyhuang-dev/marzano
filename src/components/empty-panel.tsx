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
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export { EmptyPanel };
