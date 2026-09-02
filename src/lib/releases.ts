export interface Release {
  /**
   * The day it shipped, `yyyy-MM-dd`. Doubles as the id the "seen" marker
   * stores, so two releases on one day need a suffix (`2026-09-02b`); the
   * `date` field is what gets formatted.
   */
  id: string;
  date: string;
  title: string;
  /** What changed, as a reader of the app would notice it -- not the diff. */
  notes: string[];
}

/**
 * The changelog, newest first. The top entry is the version this build calls
 * itself: a browser that last saw an older id gets told, and a deploy that
 * adds no entry tells nobody -- which is the point. Bug fixes and CI churn
 * have no business interrupting anyone; a new entry is a decision that this
 * one is worth a notice.
 */
export const RELEASES: Release[] = [
  {
    id: "2026-09-02",
    date: "2026-09-02",
    title: "Reorder by hand, a welcome guide, and this list",
    notes: [
      "Drag a task by its grip handle to move it, or focus the handle and use the arrow keys. Under a date sort, a task can trade places with the tasks sharing its deadline.",
      "The sort option that keeps your own order is now called Manual order, since that is what it does.",
      "A first run opens a short guide to what Marzano is and where your data lives. It stays in the sidebar under Guide.",
      "What's new tells you when Marzano has changed since your last visit, and keeps the history here. The notice can be turned off below or in Settings.",
      "Marzano has an icon: a tomato wearing a check, in the browser tab and at the top of the sidebar. A San Marzano is a tomato, and the timer is a pomodoro.",
    ],
  },
  {
    id: "2026-08-27",
    date: "2026-08-27",
    title: "Calendar, Settings, and Backup",
    notes: [
      "Calendar lays your open tasks out on the days they are due, a week or a month at a time, and adds tasks straight onto a day.",
      "Settings collects the theme, seven accent colours, and a display size that scales the whole app.",
      "Backup writes your tasks, tags and Pomodoro history to one JSON file, and reads it back either merged into or replacing what is here.",
      "Deleting a task or tag now leaves a marker behind, so a deletion survives a backup merge instead of being undone by the older copy.",
    ],
  },
  {
    id: "2026-08-24",
    date: "2026-08-24",
    title: "Dark theme and a new Pomodoro page",
    notes: [
      "A dark theme, following the system by default. The switch is in the sidebar footer.",
      "The Pomodoro page is laid out like the rest of the app: the ring is the one thing in colour, the focus task is the same row as on the task list, and Activity splits into Today, Last 7 days and Recent rounds.",
      "The app is called Marzano.",
    ],
  },
  {
    id: "2026-08-23",
    date: "2026-08-23",
    title: "First release",
    notes: [
      "A task list with optional due dates and tags, edited inline and checked off with an Undo.",
      "Reminders when a task falls due, including in a tab left open in the background.",
      "A Pomodoro timer that credits its focus time to the task you picked.",
      "Completed tasks are kept for thirty days, then removed.",
    ],
  },
];

export const LATEST_RELEASE: Release = RELEASES[0];

/**
 * The releases a browser has not seen: everything above `seenId` in the list.
 * An id the list no longer holds -- an entry that was removed, or storage from
 * a build that never shipped -- counts as never having seen any of them,
 * which errs towards showing a notice rather than losing one.
 */
export function releasesSince(seenId: string | null): Release[] {
  if (seenId === null) return RELEASES;

  const index = RELEASES.findIndex((release) => release.id === seenId);
  return index === -1 ? RELEASES : RELEASES.slice(0, index);
}
