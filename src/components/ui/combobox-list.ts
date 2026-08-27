/**
 * Placement maths shared by the combobox fields, so every list the app opens
 * from a field measures the same way: it opens towards whichever side of the
 * nearest scrolling ancestor has room, and never grows past the room it found.
 */

export interface Placement {
  above: boolean;
  maxHeight: number;
}

export const MIN_LIST_HEIGHT = 96;
export const MAX_LIST_HEIGHT = 192;

/**
 * Only one field list is open at a time. Closing relies on blur, but a tap on
 * a button does not always blur the focused input (iOS Safari is the classic
 * offender), so two lists could sit open together. Whichever list opens next
 * closes the one that was open by calling its closer directly.
 */
type CloseList = () => void;

let closeOpenList: CloseList | null = null;

/**
 * Claims the single open-list slot, closing whoever held it, and returns a
 * release function for when the claimer closes or unmounts.
 */
export function claimListOpen(close: CloseList): () => void {
  if (closeOpenList && closeOpenList !== close) closeOpenList();
  closeOpenList = close;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (closeOpenList === close) closeOpenList = null;
  };
}

export function measurePlacement(field: HTMLElement): Placement {
  const rect = field.getBoundingClientRect();
  const bounds = scrollParentRect(field);
  const above = rect.top - bounds.top;
  const below = bounds.bottom - rect.bottom;
  const room = Math.max(above, below);

  return {
    above: above > below,
    maxHeight: Math.max(
      MIN_LIST_HEIGHT,
      Math.min(MAX_LIST_HEIGHT, room - 12),
    ),
  };
}

/** Bounds of the nearest scrolling ancestor, which is what clips the list. */
function scrollParentRect(node: HTMLElement): { top: number; bottom: number } {
  let current = node.parentElement;

  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") {
      return current.getBoundingClientRect();
    }
    current = current.parentElement;
  }

  return { top: 0, bottom: window.innerHeight };
}
