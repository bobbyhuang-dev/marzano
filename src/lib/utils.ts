import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Opening a dialog straight into a field pops the on-screen keyboard over it, so
 * on touch the title takes focus instead and the content stays visible.
 */
export function focusDialogTitleOnTouch(event: Event, title: HTMLElement | null) {
  if (window.matchMedia("(pointer: coarse)").matches) {
    event.preventDefault();
    window.requestAnimationFrame(() => title?.focus());
  }
}
