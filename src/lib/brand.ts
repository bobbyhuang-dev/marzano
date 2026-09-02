/**
 * The Marzano mark: a tomato wearing a check. A San Marzano is a tomato and
 * the timer is a pomodoro, so the fruit is the app's own pun; the check is
 * what the app is for.
 *
 * One compound path on purpose. The body, stem and leaves wind clockwise and
 * the check winds the other way, so under the default nonzero fill rule the
 * check is a hole showing whatever is behind the mark -- the sidebar's card,
 * a tab strip, a home-screen tile -- with no mask, no id and no second colour.
 * The same rule is why the left leaf is not simply the right one mirrored:
 * mirroring reverses the winding, and a leaf wound the wrong way would cut a
 * sliver out of the body and stem wherever it overlaps them.
 * That is what lets the same string serve the inline component, which paints
 * it in `currentColor`, and the favicon files scripts/render-icons.mjs renders.
 */
/**
 * The mark is drawn in a 64-unit square, but it does not fill it: the stem
 * tops out at 5 and the body sits on 62, so a viewBox of the full square puts
 * the mark's own centre 1.5 units below the box's, which reads as the mark
 * riding low beside text that a flex row has centred on the box. The viewBox
 * is therefore the mark's own bounds, so centring the box centres the mark.
 * The favicon renderer keeps the square for the breathing room a tab wants.
 */
export const BRAND_MARK_BOUNDS = { x: 5.5, y: 5, width: 53, height: 57 };

export const BRAND_MARK_VIEWBOX = [
  BRAND_MARK_BOUNDS.x,
  BRAND_MARK_BOUNDS.y,
  BRAND_MARK_BOUNDS.width,
  BRAND_MARK_BOUNDS.height,
].join(" ");

export const BRAND_MARK_PATH =
  "M 32 14 C 48.43 14 58.5 23.12 58.5 38 C 58.5 52.88 48.43 62 32 62 C 15.57 62 5.5 52.88 5.5 38 C 5.5 23.12 15.57 14 32 14 Z " +
  "M 29.25 18 L 29.25 7.75 A 2.75 2.75 0 0 1 34.75 7.75 L 34.75 18 Z " +
  "M 33 17 Q 37.23 6.54 48.5 7 Q 44.27 17.46 33 17 Z " +
  "M 31 17 Q 19.73 17.46 15.5 7 Q 26.77 6.54 31 17 Z " +
  "M 14.49 40.51 L 23.99 50.01 A 4.25 4.25 0 0 0 30.01 50.01 L 49.51 30.51 A 4.25 4.25 0 0 0 49.51 24.49 A 4.25 4.25 0 0 0 43.49 24.49 L 27 40.99 L 20.51 34.49 A 4.25 4.25 0 0 0 14.49 34.49 A 4.25 4.25 0 0 0 14.49 40.51 Z";
