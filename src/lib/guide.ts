import type { PomodoroSessionRecord } from "@/lib/pomodoro";
import type { Tag } from "@/lib/tags";
import type { Task } from "@/lib/tasks";

const GUIDE_STORAGE_KEY = "marzano.guide.v1";

/**
 * "open": the checklist has shown itself and has not been put away, so it
 * comes back on the next visit however much data there is by then.
 * "seen": it was hidden or finished; it stays gone until the Guide button.
 */
type GuideState = "unseen" | "open" | "seen";

function loadGuideState(): GuideState {
  try {
    const value = window.localStorage.getItem(GUIDE_STORAGE_KEY);
    return value === "seen" || value === "open" ? value : "unseen";
  } catch {
    return "unseen";
  }
}

function saveGuideState(state: Exclude<GuideState, "unseen">) {
  try {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, state);
  } catch {
    // A guide that introduces itself twice is better than one that crashes.
  }
}

/** The checklist is on screen; remember to bring it back next time. */
export function saveGuideShown() {
  saveGuideState("open");
}

/** The checklist was hidden or finished. */
export function saveGuideSeen() {
  saveGuideState("seen");
}

/**
 * The first-run rule. The checklist shows itself unasked to a browser that has
 * never been through it and has nothing in it yet -- someone who already has
 * tasks or tags knows what the app is -- and to one that was part-way through
 * it last time. Everyone else gets the sidebar button, which is also where
 * anyone who hid it finds it again. `expanded` says whether to open it out
 * rather than only show the launcher: a first visit opens it, a return does
 * not, because the count on the launcher is enough of a reminder.
 */
export function guideAtStartup(hasData: boolean): { shown: boolean; expanded: boolean } {
  const state = loadGuideState();
  if (state === "open") return { shown: true, expanded: false };
  if (state === "unseen" && !hasData) return { shown: true, expanded: true };
  return { shown: false, expanded: false };
}

export type GuideStepId = "write" | "date" | "tag" | "focus" | "keep";

interface GuideProgressInput {
  /** Every task record, tombstones included: a task written and then deleted was still written. */
  tasks: Task[];
  tags: Tag[];
  history: PomodoroSessionRecord[];
  folder: string | null;
  canChooseFolder: boolean;
}

/**
 * Which steps are done, read off the data rather than remembered: a step is
 * ticked because the thing exists, so the list is honest on any browser the
 * data is opened in, and nothing is stored for it. `keep` is absent where
 * the browser has no folder picker, rather than shown as a step that can
 * never be ticked.
 */
export function guideProgress({
  tasks,
  tags,
  history,
  folder,
  canChooseFolder,
}: GuideProgressInput): { id: GuideStepId; done: boolean }[] {
  const steps: { id: GuideStepId; done: boolean }[] = [
    { id: "write", done: tasks.length > 0 },
    { id: "date", done: tasks.some((task) => task.dueAt !== null) },
    { id: "tag", done: tags.length > 0 || tasks.some((task) => task.tagIds.length > 0) },
    {
      id: "focus",
      done: history.length > 0 || tasks.some((task) => task.focusedMs > 0),
    },
  ];
  if (canChooseFolder) steps.push({ id: "keep", done: folder !== null });
  return steps;
}
