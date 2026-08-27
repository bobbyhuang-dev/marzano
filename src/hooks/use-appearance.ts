import { useEffect, useState } from "react";

import {
  type AccentId,
  applyAccent,
  applyZoom,
  loadAccent,
  loadZoom,
  saveAccent,
  saveZoom,
  type ZoomLevel,
} from "@/lib/appearance";

export interface AppearanceController {
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
  zoom: ZoomLevel;
  setZoom: (zoom: ZoomLevel) => void;
}

/**
 * The look of the app that is not the light/dark choice: which colour the
 * primary surfaces carry, and how big the whole layout is drawn. Both are on
 * the document before React mounts (see the script in `index.html`); this only
 * keeps them in step with what the reader picks afterwards.
 */
export function useAppearance(): AppearanceController {
  const [accent, setAccent] = useState<AccentId>(loadAccent);
  const [zoom, setZoom] = useState<ZoomLevel>(loadZoom);

  useEffect(() => {
    saveAccent(accent);
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    saveZoom(zoom);
    applyZoom(zoom);
  }, [zoom]);

  return { accent, setAccent, zoom, setZoom };
}
