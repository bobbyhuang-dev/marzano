import type { Transition, Variants } from "motion/react";

/**
 * The JS half of the motion tokens. `index.css` is the source of truth --
 * `--ease-out-cubic` and `--transition-duration-*` in its `@theme` -- and
 * these restate the same values for `motion`, which cannot read a stylesheet.
 * A change to either copy has to be made in the other.
 */
export const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;

/** Milliseconds: `fast` answers the pointer and ends things, `base` brings them in. */
export const DURATION = { fast: 150, base: 200 } as const;

function tween(ms: number): Transition {
  return { type: "tween", duration: ms / 1000, ease: [...EASE_OUT_CUBIC] };
}

export const TRANSITION = {
  fast: tween(DURATION.fast),
  base: tween(DURATION.base),
} as const;

type PopoverSide = "below" | "above";

/**
 * A menu growing out of its trigger, the same shape the CSS `popover-in`
 * keyframes used to draw. `hidden` doubles as the exit, at the fast length.
 */
function popoverVariants(side: PopoverSide): Variants {
  return {
    hidden: {
      opacity: 0,
      y: side === "below" ? "-0.25rem" : "0.25rem",
      scale: 0.98,
      transition: TRANSITION.fast,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: TRANSITION.base,
    },
  };
}

const POPOVER_BELOW = popoverVariants("below");
const POPOVER_ABOVE = popoverVariants("above");

/** Spread onto the panel element inside an `AnimatePresence`. */
export function popoverMotion(side: PopoverSide = "below") {
  return {
    variants: side === "below" ? POPOVER_BELOW : POPOVER_ABOVE,
    initial: "hidden",
    animate: "visible",
    exit: "hidden",
  } as const;
}

/**
 * A row joining or leaving a list: the list closes over it rather than
 * jumping. The row must carry no vertical padding of its own, or a height of
 * zero still leaves the padding standing.
 */
const LIST_ROW: Variants = {
  hidden: { opacity: 0, height: 0, transition: TRANSITION.fast },
  visible: { opacity: 1, height: "auto", transition: TRANSITION.base },
};

export const listRowMotion = {
  variants: LIST_ROW,
  initial: "hidden",
  animate: "visible",
  exit: "hidden",
} as const;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

let crossfadeTimer: number | undefined;

/**
 * Runs a palette change under a page-wide crossfade: `[data-theme-transition]`
 * in `index.css` gives every element a colour transition for as long as the
 * attribute is on. Callers only come here when the document actually changes,
 * which is what keeps the first paint -- already done by `index.html` -- from
 * fading in. The timer is shared so a quick second change cannot strand the
 * attribute after the first one's clear.
 */
export function crossfadeDocument(apply: () => void) {
  if (prefersReducedMotion()) {
    apply();
    return;
  }

  const root = document.documentElement;

  root.dataset.themeTransition = "";
  apply();
  window.clearTimeout(crossfadeTimer);
  crossfadeTimer = window.setTimeout(() => {
    delete root.dataset.themeTransition;
  }, DURATION.base + 50);
}
