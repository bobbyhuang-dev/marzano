import { type RefObject, useCallback, useEffect, useState } from "react";

export interface ScrollEdges {
  /** Content is hidden past the top edge. */
  above: boolean;
  /** Content is hidden past the bottom edge. */
  below: boolean;
}

/**
 * Whether a scroller has content hidden past either edge, so the edge can be
 * faded instead of ruled: a rule says "this scrolls" even when it does not, a
 * fade appears only while something is out of view. Read again on scroll
 * (attach `sync`) and whenever the scroller or its content resizes.
 */
function useScrollEdges(ref: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState<ScrollEdges>({
    above: false,
    below: false,
  });

  const sync = useCallback(() => {
    const area = ref.current;
    if (!area) return;

    const above = area.scrollTop > 1;
    const below = area.scrollTop + area.clientHeight < area.scrollHeight - 1;

    setEdges((current) =>
      current.above === above && current.below === below
        ? current
        : { above, below },
    );
  }, [ref]);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;

    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(area);
    if (area.firstElementChild) observer.observe(area.firstElementChild);

    return () => observer.disconnect();
  }, [ref, sync]);

  return { edges, sync };
}

export { useScrollEdges };
