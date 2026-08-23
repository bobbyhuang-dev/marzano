import { useEffect, type RefObject } from "react";

interface MenuDismissOptions {
  open: boolean;
  /** The menu and its trigger together: anything outside this closes the menu. */
  container: RefObject<HTMLElement | null>;
  /** Focused when Escape closes the menu, so the keyboard lands where it started. */
  trigger: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Closes a popover the three ways one gets left: a pointer outside it, focus
 * tabbing past its last row, or Escape.
 */
export function useMenuDismiss({
  open,
  container,
  trigger,
  onClose,
}: MenuDismissOptions) {
  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) onClose();
    };

    const closeOnFocusLeaving = (event: FocusEvent) => {
      if (!container.current?.contains(event.target as Node)) onClose();
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      onClose();
      trigger.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("focusin", closeOnFocusLeaving);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("focusin", closeOnFocusLeaving);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, container, trigger, onClose]);
}
