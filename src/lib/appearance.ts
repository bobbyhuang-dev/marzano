const ACCENT_STORAGE_KEY = "marzano.accent.v1";

const ZOOM_STORAGE_KEY = "marzano.zoom.v1";

/**
 * The accent names, and nothing else: the colours themselves live in
 * `index.css`, keyed by the same ids on `:root[data-accent]`. Two copies of a
 * palette drift apart, and the page has to be painted before React runs
 * anyway -- the pre-paint script in `index.html` only has to set the attribute.
 */
export const ACCENTS = [
  { id: "graphite", label: "Graphite" },
  { id: "blue", label: "Blue" },
  { id: "violet", label: "Violet" },
  { id: "teal", label: "Teal" },
  { id: "green", label: "Green" },
  { id: "amber", label: "Amber" },
  { id: "rose", label: "Rose" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

/** The neutral palette the app shipped with, so the default changes nothing. */
export const DEFAULT_ACCENT: AccentId = "graphite";

/**
 * Whole steps rather than a slider: every value has to stay legible, and the
 * page reflows under the pointer while it is being dragged.
 */
export const ZOOM_LEVELS = [80, 90, 100, 110, 125, 150] as const;

export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

export const DEFAULT_ZOOM: ZoomLevel = 100;

function toAccent(value: unknown): AccentId {
  return ACCENTS.some((accent) => accent.id === value)
    ? (value as AccentId)
    : DEFAULT_ACCENT;
}

export function accentLabel(accent: AccentId): string {
  return ACCENTS.find((entry) => entry.id === accent)?.label ?? "Graphite";
}

function toZoom(value: unknown): ZoomLevel {
  const parsed = Number(value);

  return ZOOM_LEVELS.includes(parsed as ZoomLevel)
    ? (parsed as ZoomLevel)
    : DEFAULT_ZOOM;
}

export function loadAccent(): AccentId {
  try {
    return toAccent(window.localStorage.getItem(ACCENT_STORAGE_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(accent: AccentId) {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // An accent that forgets itself is better than one that crashes.
  }
}

export function loadZoom(): ZoomLevel {
  try {
    return toZoom(window.localStorage.getItem(ZOOM_STORAGE_KEY));
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function saveZoom(zoom: ZoomLevel) {
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  } catch {
    // As above: the preference is worth losing, the app is not.
  }
}

/** Mirrors the pre-paint script in `index.html`. */
export function applyAccent(accent: AccentId) {
  document.documentElement.dataset.accent = accent;
}

/**
 * Everything in the app is sized in `rem`, so moving the root font size moves
 * the whole layout -- type, spacing, icons and the sidebar -- rather than
 * scaling the text out of the boxes it sits in.
 */
export function applyZoom(zoom: ZoomLevel) {
  document.documentElement.style.fontSize =
    zoom === DEFAULT_ZOOM ? "" : `${zoom}%`;
}

/** The next step up or down, or the current one at either end of the range. */
export function stepZoom(zoom: ZoomLevel, direction: 1 | -1): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(zoom);
  const next = index === -1 ? ZOOM_LEVELS.indexOf(DEFAULT_ZOOM) : index + direction;

  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, next))];
}
