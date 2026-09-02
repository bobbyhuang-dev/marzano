import releases from "virtual:releases";

export interface Release {
  /** The commit hash. Doubles as the id the "seen" marker stores. */
  id: string;
  /** When it was committed, as an ISO instant. */
  date: string;
  /** The commit subject, without its conventional `type(scope):` prefix. */
  title: string;
  /** The commit body, one entry per paragraph; empty when there was none. */
  notes: string[];
}

/**
 * The changelog is the git log, newest first, as `scripts/git-releases.ts`
 * hands it over at build time. The top entry is the version this build calls
 * itself: a browser that last saw an older commit gets told, and a deploy
 * whose commits are all plumbing (`chore`, `ci`, and the rest that plugin
 * hides) tells nobody. Writing a good commit message is writing the notice.
 */
export const RELEASES: Release[] = releases;

/** Null only in a build made outside a git checkout. */
export const LATEST_RELEASE: Release | null = RELEASES[0] ?? null;

/**
 * The releases a browser has not seen: everything above `seenId` in the list.
 * An id the list no longer holds -- a commit rewritten away, or storage from
 * a build that never shipped -- counts as never having seen any of them,
 * which errs towards showing a notice rather than losing one.
 */
export function releasesSince(seenId: string | null): Release[] {
  if (seenId === null) return RELEASES;

  const index = RELEASES.findIndex((release) => release.id === seenId);
  return index === -1 ? RELEASES : RELEASES.slice(0, index);
}
