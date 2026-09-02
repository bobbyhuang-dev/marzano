import { LATEST_RELEASE, releasesSince } from "@/lib/releases";

const WHATS_NEW_STORAGE_KEY = "marzano.whats-new.v1";

export interface WhatsNewState {
  /** The id of the newest release this browser has seen, or null on a first visit. */
  seenId: string | null;
  /** Whether the reader asked not to be told about updates. */
  muted: boolean;
}

const DEFAULT_STATE: WhatsNewState = { seenId: null, muted: false };

function toWhatsNewState(value: unknown): WhatsNewState {
  if (!value || typeof value !== "object") return DEFAULT_STATE;

  const record = value as Record<string, unknown>;
  return {
    seenId: typeof record.seenId === "string" ? record.seenId : null,
    muted: record.muted === true,
  };
}

export function loadWhatsNew(): WhatsNewState {
  try {
    const raw = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    return raw ? toWhatsNewState(JSON.parse(raw)) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveWhatsNew(state: WhatsNewState) {
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A notice that repeats itself is better than an app that crashes.
  }
}

/**
 * Whether a browser opening this build should be told it has changed. A first
 * visit never is: there is nothing to have changed *from*, and the guide is
 * already introducing the app. Past that, it takes an unseen release and a
 * reader who has not asked for silence.
 */
export function shouldAnnounceRelease(state: WhatsNewState): boolean {
  return (
    state.seenId !== null &&
    !state.muted &&
    releasesSince(state.seenId).length > 0
  );
}

/** The state after the current build has been seen, whichever way that happened. */
export function markReleaseSeen(state: WhatsNewState): WhatsNewState {
  return state.seenId === LATEST_RELEASE.id
    ? state
    : { ...state, seenId: LATEST_RELEASE.id };
}
