import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import {
  Check,
  ExternalLink,
  Minus,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  type LucideIcon,
} from "lucide-react";

import { SettingToggle } from "@/components/setting-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  ACCENTS,
  type AccentId,
  accentLabel,
  DEFAULT_ZOOM,
  stepZoom,
  ZOOM_LEVELS,
  type ZoomLevel,
} from "@/lib/appearance";
import { type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Shared with the guide, so the two places that link out cannot drift. */
export const REPOSITORY_URL = "https://github.com/bobbyhuang-dev/marzano";

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: LucideIcon }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/**
 * No icon column, unlike the backup dialog: these sections are made of
 * full-width controls, and indenting them past an icon would leave the rows
 * hanging off the right edge of the window. A rule between sections does the
 * separating the icons would have done.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-border [&+&]:border-t [&+&]:pt-6">
      <div className="grid gap-1">
        <h3 className="text-sm font-semibold leading-none text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

/**
 * A labelled row. The label is a `span` with an id rather than a `<label>`:
 * every control below is a group of buttons, which nothing can be `for`.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  /** The current value, spelled out beside the label. */
  hint?: string;
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-sm font-medium leading-none">
          {label}
        </span>
        {hint ? (
          <span className="truncate text-sm tabular-nums text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      {children(labelId)}
    </div>
  );
}

interface ThemeChoiceProps {
  value: ThemePreference;
  onValueChange: (theme: ThemePreference) => void;
  labelledBy: string;
}

/**
 * The same control the sidebar footer carries, with room here for the labels
 * the icons stand in for there.
 */
function ThemeChoice({ value, onValueChange, labelledBy }: ThemeChoiceProps) {
  return (
    <SegmentedControl
      aria-labelledby={labelledBy}
      options={THEME_OPTIONS}
      value={value}
      onValueChange={onValueChange}
      stretch
    />
  );
}

interface AccentChoiceProps {
  value: AccentId;
  onValueChange: (accent: AccentId) => void;
  labelledBy: string;
}

/**
 * One tab stop for the row, then the arrow keys walk it -- the tag palette's
 * behaviour, over the accents rather than the tag colours. Each swatch paints
 * itself from its own `--primary`, so it previews the accent in the theme
 * currently on screen (see `[data-swatch]` in index.css).
 */
function AccentChoice({ value, onValueChange, labelledBy }: AccentChoiceProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selectedIndex = ACCENTS.findIndex((accent) => accent.id === value);

  const moveTo = (index: number) => {
    const clamped = Math.min(ACCENTS.length - 1, Math.max(0, index));

    onValueChange(ACCENTS[clamped].id);
    rowRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${clamped}"]`)
      ?.focus();
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

    if (event.key in steps) {
      event.preventDefault();
      moveTo(index + steps[event.key]);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : ACCENTS.length - 1);
    }
  };

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-7 gap-2.5"
    >
      {ACCENTS.map((accent, index) => {
        const selected = index === selectedIndex;

        return (
          <button
            key={accent.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={accent.label}
            title={accent.label}
            data-index={index}
            data-swatch={accent.id}
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(accent.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "relative flex aspect-square w-full items-center justify-center rounded-full text-primary-foreground shadow-swatch transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-95",
              // Survives focus because focus is an outline rather than a ring: arrowing
              // across the row moves the selection with it, so the two are always on the
              // same swatch and a second ring would only overwrite this one.
              selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          >
            <Check
              aria-hidden="true"
              strokeWidth={3}
              className={cn(
                "size-[45%] transition-opacity duration-150 ease-out",
                selected ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

interface ZoomChoiceProps {
  value: ZoomLevel;
  onValueChange: (zoom: ZoomLevel) => void;
  labelledBy: string;
}

function ZoomChoice({ value, onValueChange, labelledBy }: ZoomChoiceProps) {
  return (
    <div className="grid gap-2">
      <div
        role="group"
        aria-labelledby={labelledBy}
        className="flex items-center gap-2"
      >
        <Button
          variant="outline"
          size="icon"
          aria-label="Smaller"
          disabled={value === ZOOM_LEVELS[0]}
          onClick={() => onValueChange(stepZoom(value, -1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        {/* The steps themselves, as a bar: how far along the range this is
            reads faster than the number alone. */}
        <div className="flex flex-1 items-center gap-1">
          {ZOOM_LEVELS.map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-150 ease-out",
                level <= value ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Larger"
          disabled={value === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          onClick={() => onValueChange(stepZoom(value, 1))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {value === DEFAULT_ZOOM ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start px-2 text-muted-foreground"
          onClick={() => onValueChange(DEFAULT_ZOOM)}
        >
          <RotateCcw aria-hidden="true" />
          Reset to {DEFAULT_ZOOM}%
        </Button>
      )}
    </div>
  );
}

interface SettingsDialogProps {
  trigger: ReactNode;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  accent: AccentId;
  onAccentChange: (accent: AccentId) => void;
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  announceUpdates: boolean;
  onAnnounceUpdatesChange: (announce: boolean) => void;
}

/**
 * Everything about the app rather than about the work in it. Each control
 * takes effect the moment it is pressed -- the dialog is the preview, since it
 * is drawn in the accent and at the size being chosen -- so there is nothing
 * to save and nothing to cancel.
 */
function SettingsDialog({
  trigger,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  zoom,
  onZoomChange,
  announceUpdates,
  onAnnounceUpdatesChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[min(36rem,calc(100dvh-2rem))] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-5 pb-4 min-[420px]:p-6 min-[420px]:pb-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            How Marzano looks. Your tasks are not touched.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
          <div className="grid gap-6 p-5 min-[420px]:p-6">
            <Section
              title="Appearance"
              description="The theme and the colour it is drawn in."
            >
              <Field label="Theme">
                {(labelId) => (
                  <ThemeChoice
                    value={theme}
                    onValueChange={onThemeChange}
                    labelledBy={labelId}
                  />
                )}
              </Field>
              <Field label="Accent colour" hint={accentLabel(accent)}>
                {(labelId) => (
                  <AccentChoice
                    value={accent}
                    onValueChange={onAccentChange}
                    labelledBy={labelId}
                  />
                )}
              </Field>
            </Section>

            <Section
              title="Display size"
              description="Scales the whole app, not just the text."
            >
              <Field label="Size" hint={`${zoom}%`}>
                {(labelId) => (
                  <ZoomChoice
                    value={zoom}
                    onValueChange={onZoomChange}
                    labelledBy={labelId}
                  />
                )}
              </Field>
            </Section>

            <Section
              title="Updates"
              description="Marzano changes from time to time. This is how you hear about it."
            >
              {/* The toggle row carries its own vertical padding for a list of
                  them; alone under a heading it is trimmed back. */}
              <SettingToggle
                title="Announce updates"
                description="A short notice when Marzano has changed since your last visit. The full list stays under What's new in the sidebar."
                checked={announceUpdates}
                onCheckedChange={onAnnounceUpdatesChange}
                className="py-0"
              />
            </Section>

            <Section
              title="About"
              description="A task list with due reminders, tags, and a Pomodoro timer."
            >
              <p className="text-sm text-muted-foreground">
                Marzano runs entirely in this browser: no account, no server, and
                nothing leaves the machine. Keep a copy of your data with Backup.
              </p>
              <Button variant="outline" className="justify-start" asChild>
                <a href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
                  <ExternalLink aria-hidden="true" />
                  GitHub repository
                </a>
              </Button>
            </Section>
          </div>
        </div>

        <div className="flex shrink-0 justify-end p-5 min-[420px]:p-6">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { SettingsDialog };
