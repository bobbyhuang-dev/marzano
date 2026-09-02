const GUIDE_STORAGE_KEY = "marzano.guide.v1";

const SEEN_VALUE = "seen";

/** Whether this browser has already been through -- or dismissed -- the guide. */
export function loadGuideSeen(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) === SEEN_VALUE;
  } catch {
    return false;
  }
}

export function saveGuideSeen() {
  try {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, SEEN_VALUE);
  } catch {
    // A guide that introduces itself twice is better than one that crashes.
  }
}

/**
 * The first-run rule. The guide shows itself unasked only to a browser that has
 * never been through it and has nothing in it yet: someone who already has
 * tasks or tags knows what the app is, and a dialog over their work would be an
 * interruption rather than an introduction. They get the sidebar button, which
 * is also where anyone who skipped it finds it again.
 */
export function shouldOpenGuide(hasData: boolean): boolean {
  return !hasData && !loadGuideSeen();
}
