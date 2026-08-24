import { useEffect, useState } from "react";

import {
  applyTheme,
  loadTheme,
  type ResolvedTheme,
  saveTheme,
  systemTheme,
  type ThemePreference,
  watchSystemTheme,
} from "@/lib/theme";

export interface ThemeController {
  /** What the user picked, which is what the control shows. */
  theme: ThemePreference;
  /** What is on screen right now, with `system` already resolved. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

export function useTheme(): ThemeController {
  const [theme, setTheme] = useState<ThemePreference>(loadTheme);
  // Tracked apart from the preference so the OS switching under a `system`
  // reader repaints the app without rewriting what they chose.
  const [systemPreference, setSystemPreference] =
    useState<ResolvedTheme>(systemTheme);
  const resolvedTheme = theme === "system" ? systemPreference : theme;

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  useEffect(() => watchSystemTheme(setSystemPreference), []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme };
}
