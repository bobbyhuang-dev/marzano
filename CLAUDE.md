# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node 24 LTS (pinned in `.nvmrc`; `engines` allows 20.19+/22.13+/24+) and pnpm (pinned via `packageManager`). Use pnpm — npm/yarn will produce a lockfile the project does not track.

```bash
pnpm dev       # Vite dev server
pnpm build     # tsc -b (type-check, noEmit) then vite build -> dist/
pnpm lint      # eslint .
pnpm preview   # serve the built dist/
```

There is no test suite and no test runner configured. `pnpm build` is the only verification gate: it type-checks the whole `src` project before bundling.

## Architecture

A single-page, offline-only task manager: React 19 + Vite 8 + Tailwind v4 + shadcn/ui (new-york, `components.json`). No router, no server, no state library. `@/*` resolves to `src/*` (aliased in both `vite.config.ts` and `tsconfig.app.json`).

**`src/App.tsx` is the whole application state.** Tasks, tags, the active view, the tag filter, the due sort, and the draft task all live in `useState` there and are passed down as props. "Navigation" is the `ViewId` union (`tasks | pomodoro | completed | tags`) plus `openTagId` for the tag detail page — adding a screen means extending that union and the render ladder at the bottom of `App.tsx`, not adding a route.

**`src/lib/` holds the domain logic; components stay presentational.** Each module owns one slice of persisted state and exports pure helpers plus its own `load*`/`save*`:

- `lib/tasks.ts` — `Task`, due-date parsing/formatting, sorting, completion retention.
- `lib/tags.ts` — `Tag`, the 30-colour palette, WCAG-based `readableTextColor`.
- `lib/pomodoro.ts` — settings, timer state, session history (types, validation, persistence only; no React).

**localStorage is the only persistence.** Keys are versioned: `marzano.tasks.v1`, `marzano.tags.v1`, `marzano.due-sort.v1`, `marzano.sidebar.v1`, `marzano.pomodoro.{settings,timer,history}.v1`. Every module reads through a tolerant `toX()` validator that coerces missing or corrupt fields to defaults rather than discarding the record (only records with no usable identity are dropped), and every write is wrapped in try/catch so the app still runs when storage is unavailable. **When you add a field to `Task`, `Tag`, or `PomodoroSettings`, extend the corresponding validator — anything it does not read is silently lost on the next load.** App-level `useEffect`s save each state slice on change; components never touch localStorage.

### Due dates

`Task.dueAt` is a union encoded in a string: either `yyyy-MM-dd` (day-only, comes due at *end* of that local day) or a full ISO instant. Never call `new Date(task.dueAt)` directly — use `dueAtToDate`, `dueAtToDeadline`, and `formatDueDate` from `lib/tasks.ts`, which branch on `isDateOnlyDue`.

### Background timers

Both `use-due-reminders.ts` and `use-pomodoro.ts` schedule far-future work with the same pattern: `setTimeout` delays are clamped to `MAX_TIMER_DELAY` (~24.8 days, the 32-bit limit) and re-armed, and both also recheck on `window.focus` / `visibilitychange` so a tab left open or backgrounded catches up. `use-completed-cleanup.ts` sweeps expired completed tasks the same way (hourly plus on visibility), and `purgeExpiredTasks` also runs inside `loadTasks`. Completed tasks are kept `COMPLETED_RETENTION_DAYS` (30) then deleted.

### Pomodoro

`hooks/use-pomodoro.ts` is the controller (~800 lines) over the pure state in `lib/pomodoro.ts`, and returns a `PomodoroController` consumed by `components/pomodoro-page.tsx`.

- Elapsed time is derived from wall-clock timestamps (`activeStartedAt` + `accumulatedMs`), never from counting ticks, so a reload or a sleeping machine reconstructs the correct state.
- `finishExpiredTimer` walks forward through however many phase boundaries elapsed while the tab was away, bounded by `MAX_CATCH_UP_TRANSITIONS`.
- Each focus phase carries a `sessionId`; history de-duplicates on it, which is what keeps StrictMode's double-invoke from inflating statistics.
- The hook mirrors `settings`/`timer`/`tasks`/`onAddFocusTime` into refs so its callbacks stay referentially stable while still reading current values.
- Focus time flows back to tasks: the hook calls `onAddFocusTime`, which `App.tsx` turns into `Task.focusedMs` — the one place Pomodoro writes into the task list. `pomodoro.detachCompletedTask(id)` must be called before completing or deleting a task.

### UI conventions

- `src/components/ui/` is shadcn/ui-generated — regenerate rather than hand-edit where practical. `dialog`, `alert-dialog`, `sheet`, `label`, and `button` use Radix; `checkbox`, `switch`, `calendar` (react-day-picker), `number-combobox`, and `sonner` are local.
- Dropdowns that are not Radix popovers (`due-sort-menu`, `tag-filter-menu`) share `hooks/use-menu-dismiss.ts` for outside-pointer / focus-out / Escape dismissal.
- Toasts are `sonner` (`toast.*`); the completion toast carries the Undo action. A `sr-only` `aria-live` region at the bottom of `App.tsx` announces every mutation via `setStatusMessage` — keep new mutations announcing there.
- Dialogs that open onto a text field call `focusDialogTitleOnTouch` (`lib/utils.ts`) so the on-screen keyboard does not cover the content.
- Theme: light-only. Colours are HSL channel triples in `@layer base :root` in `src/index.css`, exposed to Tailwind via `@theme` (Tailwind v4 CSS-first config — there is no `tailwind.config.js`). A `dark` variant is declared but nothing ever sets the `.dark` class.
- Files are kebab-case; components use named exports (often re-exported at the bottom of the file). Comments in this codebase explain *why* a decision was made, not what the code does — match that register.
