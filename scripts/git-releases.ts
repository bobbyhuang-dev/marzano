import { execFileSync } from "node:child_process";
import type { Plugin } from "vite";

/** Mirrors `Release` in src/lib/releases.ts; the app side owns the type. */
interface GitRelease {
  id: string;
  date: string;
  title: string;
  notes: string[];
}

const MODULE_ID = "virtual:releases";
const RESOLVED_ID = "\0" + MODULE_ID;

/**
 * Commit types that change nothing a reader can see. A deploy made of these
 * alone announces nothing, which keeps the notice for changes worth one.
 */
const HIDDEN_TYPES = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "refactor",
  "revert",
  "style",
  "test",
]);

const SUBJECT_PREFIX = /^([a-z]+)(?:\([^)]*\))?!?:\s*/;
const TRAILER_LINE = /^[A-Za-z][\w-]*:\s\S/;

function readLog(): string {
  try {
    return execFileSync(
      "git",
      ["log", "--format=%H%x1f%cI%x1f%s%x1f%b%x1e"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    // Not a checkout, or no git: the list is empty rather than the build broken.
    return "";
  }
}

/** The body as paragraphs, minus the trailer block git conventions put last. */
function toNotes(body: string): string[] {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(
      (paragraph) =>
        paragraph.length > 0 &&
        !paragraph.split("\n").every((line) => TRAILER_LINE.test(line)),
    )
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " "));
}

export function collectReleases(): GitRelease[] {
  const releases: GitRelease[] = [];

  for (const record of readLog().split("\x1e")) {
    const [id, date, subject, body = ""] = record.trim().split("\x1f");
    if (!id || !date || !subject) continue;

    const prefix = SUBJECT_PREFIX.exec(subject);
    if (prefix && HIDDEN_TYPES.has(prefix[1])) continue;

    const bare = prefix ? subject.slice(prefix[0].length) : subject;
    releases.push({
      id,
      date,
      title: bare.charAt(0).toUpperCase() + bare.slice(1),
      notes: toNotes(body),
    });
  }

  return releases;
}

/**
 * Serves the git log to the app as `virtual:releases`, newest first, so the
 * changelog is the commit history and a deploy carries its own notes without
 * anyone writing them twice. Read once per build: the log cannot change
 * underneath a running dev server without a restart being the least of it.
 */
export function gitReleases(): Plugin {
  return {
    name: "marzano:git-releases",
    resolveId(id) {
      return id === MODULE_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(collectReleases())};`;
    },
  };
}
