export interface Tag {
  id: string;
  name: string;
  /** A hex colour, normally one of `TAG_COLORS`. Unknown values still render. */
  color: string;
}

export interface TagColor {
  name: string;
  hex: string;
}

/**
 * Thirty colours ordered as a spectrum, so the swatch grid reads as a gradient
 * rather than a scatter: warm hues first, then greens, blues, purples, and two
 * neutrals for the tags that are a place rather than a mood.
 */
export const TAG_COLORS: TagColor[] = [
  { name: "Red", hex: "#ef4444" },
  { name: "Crimson", hex: "#be123c" },
  { name: "Coral", hex: "#fb7185" },
  { name: "Orange", hex: "#f97316" },
  { name: "Rust", hex: "#c2410c" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Gold", hex: "#eab308" },
  { name: "Butter", hex: "#fde047" },
  { name: "Olive", hex: "#4d7c0f" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Mint", hex: "#6ee7b7" },
  { name: "Green", hex: "#22c55e" },
  { name: "Forest", hex: "#15803d" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Pine", hex: "#0f766e" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Ocean", hex: "#0369a1" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Periwinkle", hex: "#a5b4fc" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Violet", hex: "#7c3aed" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Fuchsia", hex: "#c026d3" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Magenta", hex: "#9d174d" },
  { name: "Slate", hex: "#64748b" },
  { name: "Graphite", hex: "#334155" },
];

export const DEFAULT_TAG_COLOR = TAG_COLORS[0].hex;

/** Long enough for “Organic chemistry”, short enough to stay a chip. */
export const MAX_TAG_NAME_LENGTH = 24;

export const TAGS_STORAGE_KEY = "todos.tags.v1";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

/** Reads one stored record; anything without a usable name or colour is dropped. */
function toTag(value: unknown): Tag | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<Tag>;
  if (typeof candidate.id !== "string" || !candidate.id) return null;
  if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;

  return {
    id: candidate.id,
    name: candidate.name.slice(0, MAX_TAG_NAME_LENGTH),
    color: isHexColor(candidate.color)
      ? candidate.color.toLowerCase()
      : DEFAULT_TAG_COLOR,
  };
}

export function loadTags(): Tag[] {
  try {
    const stored = window.localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(toTag).filter((tag): tag is Tag => tag !== null);
  } catch {
    return [];
  }
}

export function saveTags(tags: Tag[]) {
  try {
    window.localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // The app still works for the current session when storage is unavailable.
  }
}

export function createTag(name: string, color: string): Tag {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, MAX_TAG_NAME_LENGTH),
    color,
  };
}

/** Alphabetical, so a tag stays where the eye last found it. */
export function byTagName(a: Tag, b: Tag): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function tagsById(tags: Tag[]): Map<string, Tag> {
  return new Map(tags.map((tag) => [tag.id, tag]));
}

/** The tags a task carries, in display order; ids of deleted tags are skipped. */
export function resolveTags(ids: string[], byId: Map<string, Tag>): Tag[] {
  return ids
    .map((id) => byId.get(id))
    .filter((tag): tag is Tag => tag !== undefined)
    .sort(byTagName);
}

export function tagColorName(hex: string): string {
  return (
    TAG_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase())
      ?.name ?? "Custom"
  );
}

/**
 * The first colour no tag is using yet, so tags stay distinguishable without the
 * user having to think about it. Once every colour is taken, it cycles.
 */
export function suggestTagColor(tags: Tag[]): string {
  const taken = new Set(tags.map((tag) => tag.color.toLowerCase()));
  const free = TAG_COLORS.find((color) => !taken.has(color.hex));

  return (free ?? TAG_COLORS[tags.length % TAG_COLORS.length]).hex;
}

export function isTagNameTaken(
  tags: Tag[],
  name: string,
  exceptId?: string,
): boolean {
  const candidate = name.trim().toLowerCase();

  return tags.some(
    (tag) => tag.id !== exceptId && tag.name.trim().toLowerCase() === candidate,
  );
}

function toChannels(hex: string): [number, number, number] {
  if (!HEX_PATTERN.test(hex)) return [0, 0, 0];

  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** WCAG relative luminance, the basis for every contrast decision below. */
function relativeLuminance(hex: string): number {
  const [red, green, blue] = toChannels(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Black or white, whichever the colour carries better. Bright fills like Butter
 * take black; deep ones like Navy take white -- the label stays readable without
 * the palette having to be curated for it.
 */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const luminance = relativeLuminance(hex);
  const onBlack = (luminance + 0.05) / 0.05;
  const onWhite = 1.05 / (luminance + 0.05);

  return onBlack >= onWhite ? "#000000" : "#ffffff";
}

/** The tag colour as a translucent wash, for surfaces that only hint at it. */
export function tagTint(hex: string, alpha: number): string {
  const [red, green, blue] = toChannels(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
