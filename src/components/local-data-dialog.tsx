import { useRef, useState } from "react";
import { Download, FileJson, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyImport, summarizeBackup, type BackupSummary } from "@/lib/backup";
import { DATA_FILE_NAME, parseData, readDataFile, type DataContents } from "@/lib/data-file";
import { downloadCopy, pickDataFolder, supportsLocalFolders, storageLabel, type DataStatus, type FolderPreview, type LocalDataStore } from "@/lib/local-data";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: LocalDataStore;
  status: DataStatus;
  onApply: (contents: DataContents) => void;
}

function countLine(counts: BackupSummary): string {
  const parts: [number, string][] = [
    [counts.openTasks, "open task"],
    [counts.otherTasks, "completed task"],
    [counts.tags, "tag"],
    [counts.sessions, "focus session"],
  ];
  const line = parts.filter(([count]) => count > 0).map(([count, noun]) => `${count} ${noun}${count === 1 ? "" : "s"}`);
  return line.length === 0 ? "Nothing in it yet" : line.join(" · ");
}

function hasData(contents: DataContents): boolean {
  return contents.tasks.length > 0 || contents.tags.length > 0 || contents.pomodoro.history.length > 0;
}

/** What the dialog leads with: the one fact about where the tasks are right now. */
function describe(status: DataStatus, supported: boolean): string {
  if (status.folder) return "Files in the folder survive clearing browser data. Choose the same folder again to get them back.";
  if (!supported) return "This browser can’t save to a folder. Use Chrome or Edge on a computer, or keep a copy by hand.";
  return "Your tasks are only in this browser. Choose a folder on this computer and Marzano keeps them saved there.";
}

/**
 * One dialog for everything about where the data lives. It reads as a status
 * page rather than a manual: the current state and the one thing to do about
 * it, with the file actions kept quiet in the footer.
 */
export function LocalDataDialog({ open, onOpenChange, store, status, onApply }: Props) {
  const supported = supportsLocalFolders();
  const [preview, setPreview] = useState<FolderPreview | null>(null);
  const [fileData, setFileData] = useState<DataContents | null>(null);
  const [fileName, setFileName] = useState("");
  const [olderData, setOlderData] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const incoming = preview?.contents ?? fileData;
  const counts = incoming ? summarizeBackup(incoming) : null;
  const busy = working || status.busy;
  const attention = status.phase === "error" || status.phase === "access" || status.phase === "conflict";

  const reset = () => {
    setOlderData(false); setPreview(null); setFileData(null); setError(""); setConfirmReplace(false);
    store.cancelPreview();
  };
  const choose = async (reconnect: boolean) => {
    setError(""); setWorking(true);
    try {
      // The picker/permission call is the first await, preserving the click gesture.
      const next = reconnect ? await store.reconnect() : await store.inspect(await pickDataFolder());
      setPreview(next); setFileData(null); setConfirmReplace(false);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "Couldn’t open that folder.");
      }
    } finally { setWorking(false); }
  };
  const accept = async (mode: "replace" | "merge") => {
    if (!incoming) return;
    if (mode === "replace" && !confirmReplace && hasData(store.contents)) {
      setConfirmReplace(true); return;
    }
    setWorking(true);
    try {
      if (olderData) {
        if (!await store.acceptOlderTabData(mode, incoming, onApply)) return;
      } else if (preview) {
        const result = await store.accept(preview, mode, onApply);
        if (!result) return;
      } else {
        const next = applyImport(mode, store.contents, incoming);
        store.update(next);
        onApply(next);
        await store.flush();
      }
      reset();
    } finally { setWorking(false); }
  };
  const saveCopy = () => {
    try { downloadCopy(store.contents); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save a copy."); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) { if (!next) reset(); onOpenChange(next); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Local data</DialogTitle>
          <DialogDescription>{describe(status, supported)}</DialogDescription>
        </DialogHeader>

        <DialogBody className="py-3">
          <div className="grid gap-5">
          {status.folder ? (
            <section className="flex items-start gap-3" aria-label="Data folder">
              <FolderOpen className={cn("mt-0.5 size-5 shrink-0", attention ? "text-destructive" : "text-muted-foreground")} aria-hidden="true" />
              <div className="grid min-w-0 flex-1 gap-1 text-sm">
                <h3 className="break-words font-semibold">{status.folder} / {DATA_FILE_NAME}</h3>
                <p role="status" aria-live="polite" className={cn(attention ? "text-destructive" : "text-muted-foreground")}>
                  {storageLabel(status)}
                  {status.phase === "saved" && status.savedAt && (
                    <span className="text-muted-foreground"> · {new Date(status.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </p>
                {status.message && <p className="text-muted-foreground">{status.message}</p>}
                {!incoming && !status.olderTabChanged && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {attention && <Button size="sm" disabled={busy} onClick={() => void choose(true)}>Reconnect</Button>}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void choose(false)}>Change folder</Button>
                  </div>
                )}
              </div>
            </section>
          ) : supported && !incoming && !status.olderTabChanged && (
            <section className="grid gap-3" aria-label="Data folder">
              {status.message && <p className="text-sm text-muted-foreground">{status.message}</p>}
              <Button disabled={busy} className="justify-self-start" onClick={() => void choose(false)}>
                <FolderOpen aria-hidden="true" />{busy ? "Opening folder…" : "Choose folder"}
              </Button>
              {status.upgradeRequired && !status.upgradeCompleted && (
                <p className="text-sm text-muted-foreground">Your current tasks are copied into it. Nothing is removed from this browser.</p>
              )}
            </section>
          )}

          {status.cacheWarning && <p role="alert" className="text-sm text-destructive">{status.cacheWarning}</p>}

          {status.olderTabChanged && !incoming && (
            <section className="grid gap-3" aria-label="Older tab">
              {!status.folder && <p className="text-sm text-muted-foreground">{status.message}</p>}
              <Button disabled={busy} className="justify-self-start" onClick={() => {
                setFileData(store.getOlderTabData()); setOlderData(true); setFileName("Changes from the older tab");
              }}>Review changes</Button>
            </section>
          )}

          {incoming && counts && (
            <section className="grid gap-3 rounded-lg bg-muted/50 p-4" aria-label="Review file">
              <div className="grid gap-1 text-sm">
                <h3 className="break-words font-semibold">{preview ? `${preview.directory.name} / ${DATA_FILE_NAME}` : fileName}</h3>
                <p className="text-muted-foreground tabular-nums">{countLine(counts)}</p>
              </div>
              {confirmReplace ? (
                <p role="alert" className="text-sm text-destructive">This replaces everything in the app. Anything not in this file is lost.</p>
              ) : hasData(store.contents) && (
                <p className="text-sm text-muted-foreground">Replace what’s in the app, or merge and keep the newer copy of each task.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} variant={confirmReplace ? "destructive" : "default"} onClick={() => void accept("replace")}>
                  {confirmReplace ? "Replace" : hasData(store.contents) ? "Replace" : "Use this file"}
                </Button>
                {hasData(store.contents) && <Button disabled={busy} variant="outline" onClick={() => void accept("merge")}>Merge</Button>}
                <Button disabled={busy} variant="ghost" onClick={reset}>Cancel</Button>
              </div>
            </section>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        </DialogBody>

        <DialogFooter className="justify-start">
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy || !!incoming || status.olderTabChanged} onClick={() => input.current?.click()}>
            <FileJson aria-hidden="true" />Open a file
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy} onClick={saveCopy}>
            <Download aria-hidden="true" />Save a copy
          </Button>
          <input ref={input} type="file" accept=".json,application/json" className="hidden" tabIndex={-1} aria-label="Open a Marzano data file" onChange={async (event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            setWorking(true); setError("");
            try { setFileData(parseData(await readDataFile(file))); setFileName(file.name); setConfirmReplace(false); }
            catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t read that file."); }
            finally { setWorking(false); }
          }} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
