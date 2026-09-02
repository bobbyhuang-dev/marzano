import type { SVGProps } from "react";

import { BRAND_MARK_PATH, BRAND_MARK_VIEWBOX } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The mark as inline SVG, painted in `currentColor` so a `text-primary` on it
 * hands it the accent. It is decorative wherever it appears: the name is
 * always written out beside it.
 */
function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path d={BRAND_MARK_PATH} />
    </svg>
  );
}

export { BrandMark };
