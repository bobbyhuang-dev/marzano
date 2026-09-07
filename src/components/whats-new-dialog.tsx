import { useId } from "react";
import { format, parseISO } from "date-fns";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type Release, RELEASES } from "@/lib/releases";

function ReleaseEntry({ release, fresh }: { release: Release; fresh: boolean }) {
  return (
    <article className="grid gap-3">
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
      {release.notes.length > 0 ? (
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
      ) : null}
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
      <DialogContent
        className="max-h-[min(36rem,calc(100dvh-2rem))] max-w-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>What's new</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-7">
            {RELEASES.map((release) => (
              <ReleaseEntry
                key={release.id}
                release={release}
                fresh={unseenIds.has(release.id)}
              />
            ))}
          </div>
        </DialogBody>

        {/* The opt-out sits with the notice it silences, and again in Settings
            for the reader who ticked it in a hurry. */}
        <DialogFooter className="-ml-3 justify-start gap-0 pt-1">
          <Checkbox
            id={muteId}
            checked={muted}
            onCheckedChange={onMutedChange}
          />
          <Label htmlFor={muteId} className="cursor-pointer text-muted-foreground">
            Don't announce updates
          </Label>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { WhatsNewDialog };
