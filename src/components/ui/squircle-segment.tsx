import { useEffect, useState, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { getSvgPath } from "figma-squircle";
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";

/**
 * One panel of a segmented control, clipped to a squircle rather than rounded
 * with `border-radius`, so the corners carry the continuous curvature the
 * duration picker and the time field are both drawn from.
 *
 * The clip is a `path()`, which clips descendants as well — anything that has
 * to escape the box (a listbox, a focus ring wider than the padding) belongs
 * outside the segment. For those, position the segment `absolute inset-0`
 * behind the controls and give the controls `relative`, which paints them over
 * a segment they are not inside of.
 */

/** The outer corner every segmented control in the app rounds to. */
export const SEGMENT_RADIUS = 12;

/**
 * How far touching segments overlap. Each is painted inside its own clip, and
 * two anti-aliased clip edges meeting on a fractional pixel — which is where a
 * measured width lands — let the page show through as a hairline seam. Two
 * pixels puts the later segment's feathered edge over solid neighbour instead.
 */
export const SEAM_OVERLAP = 2;

/**
 * Focus rings inside a segment have to be drawn inwards, because the squircle
 * clip cuts off anything outside the box. The indicator is a rounded,
 * translucent inset ring rather than a full-strength outline: on the neutral
 * accent a hard near-black square reads as a mistake, not a highlight.
 * `outline-none` stays — the inset ring replaces the browser's default focus
 * box rather than sitting inside it.
 */
export const SEGMENT_FOCUS_RING =
  "outline-none focus-visible:rounded-md focus-visible:inset-ring-2 focus-visible:inset-ring-ring/40";

interface SquircleSegmentProps {
  asChild?: boolean;
  cornerSmoothing?: number;
  leftRadius: number | MotionValue<number>;
  rightRadius: number | MotionValue<number>;
  className?: string;
  style?: MotionStyle;
  children?: ReactNode;
}

const MotionSlot = motion.create(Slot);

const radiusValue = (radius: number | MotionValue<number>) =>
  typeof radius === "number" ? radius : radius.get();

function SquircleSegment({
  asChild,
  cornerSmoothing = 1,
  leftRadius,
  rightRadius,
  className,
  style,
  children,
}: SquircleSegmentProps) {
  const Component = asChild ? MotionSlot : motion.div;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      // The layout box, never the bounding rect: a segment that scales itself
      // while pressed is mid-transform when the observer fires for a resize
      // beside it, and that shrink would be baked into the clip path for good.
      const box = entry.borderBoxSize?.[0];
      const rect = box ?? {
        inlineSize: element.offsetWidth,
        blockSize: element.offsetHeight,
      };
      width.set(rect.inlineSize);
      height.set(rect.blockSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, width, height]);

  // Rebuilt on every frame of an open/close spring, because the corner radii
  // animate rather than only changing when the element resizes.
  const clipPath = useTransform(() => {
    const w = width.get();
    const h = height.get();
    if (w <= 0 || h <= 0) return "none";

    const left = radiusValue(leftRadius);
    const right = radiusValue(rightRadius);
    const path = getSvgPath({
      width: w,
      height: h,
      topLeftCornerRadius: left,
      bottomLeftCornerRadius: left,
      topRightCornerRadius: right,
      bottomRightCornerRadius: right,
      cornerSmoothing,
    });
    return `path('${path}')`;
  });

  return (
    <Component
      data-slot="squircle-segment"
      ref={setElement}
      className={className}
      style={{ ...style, clipPath }}
    >
      {children}
    </Component>
  );
}

export { SquircleSegment };
