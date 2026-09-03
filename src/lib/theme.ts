import { crossfadeDocument } from "@/lib/motion";

const THEME_STORAGE_KEY = "marzano.theme.v1";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

/** What the user picked; `system` follows the OS and can change under them. */
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** What is actually painted, once `system` has been resolved. */
export type ResolvedTheme = "light" | "dark";

/**
 * Mirrors `--background` in `index.css`, for the browser chrome that sits
 * outside the page (the mobile address bar).
 */
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f7f7f7",
  dark: "#121212",
};

function toTheme(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system";
}

export function loadTheme(): ThemePreference {
  try {
    return toTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function saveTheme(theme: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A theme that forgets itself is better than one that crashes.
  }
}

export function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Cycles system -> light -> dark, so one control covers all three. */
export function nextTheme(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}

/**
 * The one place the theme reaches the document. The class drives every token
 * in `index.css`; `color-scheme` hands the same news to the form controls,
 * scrollbars, and the native pickers the app does not style itself.
 *
 * A change crossfades; a repeat does not. Checking the document rather than
 * the previous argument is what keeps the first paint still: `index.html` has
 * already set the class, so the mount-time call finds nothing to change.
 */
export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  const dark = theme === "dark";

  const paint = () => {
    root.classList.toggle("dark", dark);
    root.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[theme]);
  };

  if (root.classList.contains("dark") === dark) paint();
  else crossfadeDocument(paint);
}

/** Only worth listening to while the preference is `system`. */
export function watchSystemTheme(
  onChange: (theme: ResolvedTheme) => void,
): () => void {
  let query: MediaQueryList;

  try {
    query = window.matchMedia(DARK_QUERY);
  } catch {
    return () => {};
  }

  const handleChange = (event: MediaQueryListEvent) => {
    onChange(event.matches ? "dark" : "light");
  };

  query.addEventListener("change", handleChange);
  return () => query.removeEventListener("change", handleChange);
}
