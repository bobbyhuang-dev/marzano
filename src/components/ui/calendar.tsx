import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarStyle = React.CSSProperties & {
  "--calendar-cell-size"?: string;
  // Rows can be shorter than they are wide so a full month still fits on short
  // viewports; defaults to the cell size for square cells.
  "--calendar-cell-height"?: string;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  style,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit bg-background p-1", className)}
      style={
        {
          "--calendar-cell-size": "clamp(2.5rem, 13.75vw, 2.75rem)",
          "--calendar-cell-height": "var(--calendar-cell-size)",
          ...style,
        } as CalendarStyle
      }
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-[var(--calendar-cell-height)] min-h-0 w-[var(--calendar-cell-size)] min-w-0 p-0",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-[var(--calendar-cell-height)] min-h-0 w-[var(--calendar-cell-size)] min-w-0 p-0",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-[var(--calendar-cell-height)] w-full items-center justify-center px-[var(--calendar-cell-size)]",
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          "text-sm font-semibold tracking-[-0.01em]",
          defaultClassNames.caption_label,
        ),
        month_grid: cn(
          "w-full border-collapse",
          defaultClassNames.month_grid,
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex h-8 w-[var(--calendar-cell-size)] items-center justify-center text-xs font-medium text-muted-foreground",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative h-[var(--calendar-cell-height)] w-[var(--calendar-cell-size)] px-0.5 py-0 text-center",
          defaultClassNames.day,
        ),
        today: cn(
          "[&>button]:bg-accent [&>button]:text-accent-foreground",
          defaultClassNames.today,
        ),
        outside: cn(
          "[&>button]:text-muted-foreground [&>button]:opacity-45",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "[&>button]:pointer-events-none [&>button]:opacity-35",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("size-4", className)}
                {...chevronProps}
              />
            );
          }

          if (orientation === "right") {
            return (
              <ChevronRight
                className={cn("size-4", className)}
                {...chevronProps}
              />
            );
          }

          return (
            <ChevronDown
              className={cn("size-4", className)}
              {...chevronProps}
            />
          );
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        "h-[var(--calendar-cell-height)] min-h-0 w-full min-w-0 p-0 font-normal tabular-nums data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:hover:bg-primary/90",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
