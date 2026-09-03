import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The motion utilities from index.css, so `cn` knows `transition-ui` and a
// `transition-[...]` are the same slot and `duration-fast` beats `duration-150`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: { ease: ["out-cubic"] },
    classGroups: {
      transition: ["transition-ui", "transition-dial"],
      duration: [{ duration: ["fast", "base"] }],
    },
  },
});

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
