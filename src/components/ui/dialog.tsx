import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { useScrollEdges } from "@/hooks/use-scroll-edges";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[200] bg-overlay backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * A dialog is three rows -- header, body, footer -- on one gutter, separated
 * by space rather than rules. The body is the only row that scrolls, and it
 * says so by fading its edges while something is out of view, so a dialog
 * that fits is one unbroken surface.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[201] flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background shadow-dialog dark:bg-popover data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-2.5 top-2.5 inline-flex size-8 items-center justify-center rounded-md pointer-coarse:size-9 text-muted-foreground transition-ui hover:bg-accent hover:text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70 disabled:pointer-events-none">
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex shrink-0 flex-col gap-1 px-5 pr-12 pt-4 pb-2 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

function ScrollEdge({ side, visible }: { side: "top" | "bottom"; visible: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 h-6 from-background to-transparent transition-ui dark:from-popover",
        side === "top" ? "top-0 bg-gradient-to-b" : "bottom-0 bg-gradient-to-t",
        visible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/**
 * The scrolling middle. Its content is wrapped once so the edge check can
 * watch it resize -- a list that grows past the dialog fades its bottom edge
 * without being scrolled first.
 */
const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, onScroll, ...props }, ref) => {
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => scroller.current as HTMLDivElement);
  const { edges, sync } = useScrollEdges(scroller);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(event) => {
          sync();
          onScroll?.(event);
        }}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2",
          className,
        )}
        {...props}
      >
        <div>{children}</div>
      </div>
      <ScrollEdge side="top" visible={edges.above} />
      <ScrollEdge side="bottom" visible={edges.below} />
    </div>
  );
});
DialogBody.displayName = "DialogBody";

/**
 * Actions end-aligned; a secondary control (a mode switch, "New tag") takes
 * `mr-auto` to sit at the start of the same row.
 */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 pt-2 pb-4",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold leading-tight tracking-[-0.01em]", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-pretty text-sm leading-normal text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
