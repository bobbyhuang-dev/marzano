import { type ReactNode, useRef, useState } from "react";
import { Download, FileJson, TriangleAlert, Upload } from "lucide-react";

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
import {
  BackupParseError,
  type BackupContents,
  type ImportMode,
  createBackup,
  downloadBackup,
  parseBackup,
  summarizeBackup,
} from "@/lib/backup";

interface BackupDialogProps {
  trigger: ReactNode;
  /** The data as it stands, both to write out and to compare an import against. */
  contents: BackupContents;
  onImport: (mode: ImportMode, incoming: BackupContents) => void;
}

function countLine(counts: [number, string][]): string {
  const parts = counts
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${count} ${noun}${count === 1 ? "" : "s"}`);

  return parts.length === 0 ? "Nothing yet" : parts.join(", ");
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Download;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold leading-none text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-2 pl-11">{children}</div>
    </section>
  );
}

/**
 * The way data gets out of this browser and back in. Everything lives in
 * localStorage, which one cleared cache or one switched browser takes with it,
 * so a plain JSON file people can keep somewhere else is the difference between
 * an app you can trust with real work and one you cannot.
 */
function BackupDialog({ trigger, contents, onImport }: BackupDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<BackupContents | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const current = summarizeBackup(contents);
  const incoming = pending ? summarizeBackup(pending) : null;

  const reset = () => {
    setPending(null);
    setConfirmingReplace(false);
    setError("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFile = async (file: File) => {
    reset();

    try {
      setPending(parseBackup(await file.text()));
    } catch (cause) {
      setError(
        cause instanceof BackupParseError
          ? cause.message
          : "That file could not be read.",
      );
    }
  };

  const runImport = (mode: ImportMode) => {
    if (!pending) return;

    onImport(mode, pending);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-5 pb-4 min-[420px]:p-6 min-[420px]:pb-4">
          <DialogTitle>Backup</DialogTitle>
          <DialogDescription>
            Marzano keeps everything in this browser. Export a copy you can keep
            elsewhere.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y border-border">
          <div className="grid gap-6 p-5 min-[420px]:p-6">
            <Section
              icon={Download}
              title="Export"
              description="One JSON file with your tasks, tags and Pomodoro history."
            >
              <p className="text-sm tabular-nums text-muted-foreground">
                {countLine([
                  [current.openTasks, "open task"],
                  [current.otherTasks, "completed task"],
                  [current.tags, "tag"],
                  [current.sessions, "focus session"],
                ])}
              </p>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => downloadBackup(createBackup(contents))}
              >
                <Download aria-hidden="true" />
                Download backup
              </Button>
            </Section>

            <Section
              icon={Upload}
              title="Import"
              description="Restore a backup, or bring in the data from another browser."
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Cleared so picking the same file twice still fires a change.
                  event.target.value = "";
                  if (file) void handleFile(file);
                }}
              />
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileJson aria-hidden="true" />
                Choose a backup file…
              </Button>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              {incoming ? (
                <div className="grid gap-3 rounded-md border border-border bg-muted/35 p-3">
                  <p className="text-sm tabular-nums text-foreground">
                    {countLine([
                      [incoming.openTasks, "open task"],
                      [incoming.otherTasks, "completed task"],
                      [incoming.tags, "tag"],
                      [incoming.sessions, "focus session"],
                    ])}{" "}
                    in this file.
                  </p>

                  {confirmingReplace ? (
                    <>
                      <p className="flex items-start gap-2 text-sm text-destructive">
                        <TriangleAlert
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          This deletes everything currently in this browser and
                          puts the file in its place.
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmingReplace(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => runImport("replace")}
                        >
                          Replace everything
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Merging is the safe default and the one that does the
                          right thing across two browsers: each task is kept in
                          whichever copy was edited last. */}
                      <Button size="sm" onClick={() => runImport("merge")}>
                        Merge into my data
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmingReplace(true)}
                      >
                        Replace everything instead
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
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

export { BackupDialog };
