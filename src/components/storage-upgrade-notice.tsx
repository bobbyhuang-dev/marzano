import { Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  supported: boolean;
  onDismiss: () => void;
  onStart: () => void;
  onSaveCopy: () => void;
}

/**
 * Shown once to a browser that already holds tasks. One fact, one promise and
 * one button: the folder dialog explains the rest when it is opened.
 */
export function StorageUpgradeNotice({ open, supported, onDismiss, onStart, onSaveCopy }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your tasks to a folder</DialogTitle>
          <DialogDescription>
            {supported
              ? "Marzano can now keep your tasks in a folder on this computer, where clearing browser data can’t reach them."
              : "Marzano can now keep your tasks in a folder on your computer. This browser can’t do that, but Chrome or Edge on a computer can."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="text-sm text-muted-foreground">
          {supported
            ? <p>Choose a folder and your current tasks are copied into it. Nothing is removed from this browser, and you can do this later from <span className="font-medium text-foreground">Local data</span> in the sidebar.</p>
            : <p>Save a copy here, then open it from <span className="font-medium text-foreground">Local data</span> there. Nothing is removed from this browser.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>Not now</Button>
          {supported
            ? <Button onClick={onStart}><FolderOpen aria-hidden="true" />Choose folder</Button>
            : <Button onClick={onSaveCopy}><Download aria-hidden="true" />Save a copy</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
