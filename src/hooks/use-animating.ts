import { useState } from "react";

/**
 * Whether a motion element is between its `initial`/`animate`/`exit` targets.
 * A list row clips its overflow only while it grows or collapses: left on
 * permanently, the clip would cut the checkbox's pull-left hit area, the focus
 * rings on its edge buttons and the lifted drag card's shadow. Drag and layout
 * animations do not raise these callbacks, so a dragged row is never clipped.
 */
export function useAnimating() {
  const [active, setActive] = useState(false);

  return {
    active,
    handlers: {
      onAnimationStart: () => setActive(true),
      onAnimationComplete: () => setActive(false),
    },
  };
}
