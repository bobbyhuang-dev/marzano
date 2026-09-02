import { useId } from "react";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type Release, RELEASES } from "@/lib/releases";

function ReleaseEntry({ release, fresh }: { release: Release; fresh: boolean }) {
  return (
    <article className="grid gap-3 border-border [&+&]:border-t [&+&]:pt-6">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <time
            dateTime={release.date}
            className="text-xs font-medium tabular-nums text-muted-foreground"
          >
            {format(parseISO(release.date), "MMM d, yyyy")}
          </time>
          {fresh ? (
            <span className="rounded-full bg-primary px-1.5 py-px text-[0.625rem] font-semibold uppercase leading-4 tracking-wide text-primary-foreground">
              New
            </span>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold leading-snug text-foreground">
          {release.title}
        </h3>
      </div>
      <ul className="grid gap-2">
        {release.notes.map((note) => (
          <li
            key={note}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"
          >
            <span
              aria-hidden="true"
              className="mt-[0.5625rem] size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
            />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The releases this browser had not seen when the page loaded. */
  unseen: Release[];
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
}

/**
 * The changelog, newest first, with the entries this browser has not met yet
 * marked. Controlled rather than carrying its own trigger, like the guide:
 * `App` opens it from the sidebar and from the notice a new build raises.
 */
function WhatsNewDialog({
  open,
  onOpenChange,
  unseen,
  muted,
  onMutedChange,
}: WhatsNewDialogProps) {
  const muteId = useId();
  const unseenIds = new Set(unseen.map((release) => release.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-5 pb-4 min-[420px]:p-6 min-[420px]:pb-4">
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>
            What has changed in Marzano, newest first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
          <div className="grid gap-6 p-5 min-[420px]:p-6">
            {RELEASES.map((release) => (
              <ReleaseEntry
                key={release.id}
                release={release}
                fresh={unseenIds.has(release.id)}
              />
            ))}
          </div>
        </div>

        {/* The opt-out sits with the notice it silences, and again in Settings
            for the reader who ticked it in a hurry. */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 p-5 min-[420px]:p-6">
          <div className="-ml-3 flex items-center">
            <Checkbox
              id={muteId}
              checked={muted}
              onCheckedChange={onMutedChange}
            />
            <Label htmlFor={muteId} className="cursor-pointer text-muted-foreground">
              Don't announce updates
            </Label>
          </div>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { WhatsNewDialog };
