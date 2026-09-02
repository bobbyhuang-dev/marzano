import { useCallback, useEffect, useState } from "react";

import { type Release, releasesSince } from "@/lib/releases";
import {
  loadWhatsNew,
  markReleaseSeen,
  saveWhatsNew,
  shouldAnnounceRelease,
} from "@/lib/whats-new";

export interface WhatsNewController {
  /**
   * The releases newer than the one this browser had seen when the page
   * loaded, newest first -- until the list has been read, after which it is
   * empty. Kept past the stamp below so the dialog can still mark them.
   */
  unseen: Release[];
  /** Whether this load should raise the notice. */
  announce: boolean;
  /** Whether there is something unseen: the dot on the sidebar button. */
  fresh: boolean;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  /**
   * The list was closed, which is when it counts as read: the badges last
   * through the first look and are gone on the next one.
   */
  markSeen: () => void;
}

/**
 * Which release this browser has been shown, and whether it wants to hear
 * about the next one. The stored state is read once, and both answers come
 * from that reading; the marker is then moved to the current build on the
 * spot, so a reload is quiet whatever happened to the notice. That also means
 * a first visit stamps itself silently: there is no earlier version for it to
 * have moved from, and the guide is already introducing the app.
 */
export function useWhatsNew(): WhatsNewController {
  const [initial] = useState(loadWhatsNew);
  const [state, setState] = useState(() => markReleaseSeen(initial));
  const [viewed, setViewed] = useState(false);
  const unseen = viewed ? [] : releasesSince(initial.seenId);

  useEffect(() => {
    saveWhatsNew(state);
  }, [state]);

  const markSeen = useCallback(() => setViewed(true), []);
  const setMuted = useCallback(
    (muted: boolean) => setState((current) => ({ ...current, muted })),
    [],
  );

  return {
    unseen,
    announce: shouldAnnounceRelease(initial),
    fresh: unseen.length > 0,
    muted: state.muted,
    setMuted,
    markSeen,
  };
}
