import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * A labelled switch row, shared by the Pomodoro settings and the app settings
 * so a toggle reads the same wherever it sits.
 */
function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const descriptionId = useId();

  return (
    <div
      className={cn(
        "flex items-center gap-4 py-3.5",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p
          id={descriptionId}
          className="mt-0.5 text-sm leading-5 text-muted-foreground"
        >
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        aria-describedby={descriptionId}
      />
    </div>
  );
}

export { SettingToggle };
