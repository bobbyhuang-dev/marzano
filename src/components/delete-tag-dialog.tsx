import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Tag } from "@/lib/tags";

interface DeleteTagDialogProps {
  tag: Tag;
  /** Tasks carrying the tag, so the dialog can say what it costs. */
  taskCount: number;
  onDelete: () => void;
}

function DeleteTagDialog({ tag, taskCount, onDelete }: DeleteTagDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${tag.name}`}
          title="Delete tag"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{tag.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {taskCount === 0
              ? "No task uses this tag. Deleting it can’t be undone."
              : `The tag comes off ${taskCount} ${taskCount === 1 ? "task" : "tasks"}, which stay exactly as they are. This action can’t be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>Delete tag</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { DeleteTagDialog };
