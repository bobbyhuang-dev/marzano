# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Node 24 LTS (pinned in `.nvmrc`; `engines` allows 20.19+/22.13+/24+) and pnpm (pinned via `packageManager`). Use pnpm — npm/yarn will produce a lockfile the project does not track.

```bash
pnpm dev       # Vite dev server
pnpm build     # tsc -b (type-check, noEmit) then vite build -> dist/client/
pnpm lint      # eslint .
pnpm preview   # serve the built dist/
pnpm icons     # re-render public/ favicons from src/lib/brand.ts (needs Node 24)
```

There is no test suite and no test runner configured. `pnpm build` is the only verification gate: it type-checks the whole `src` project before bundling.

## Architecture

A single-page, offline-only task manager: React 19 + Vite 8 + Tailwind v4 + shadcn/ui (new-york, `components.json`). No router, no server, no state library. `@/*` resolves to `src/*` (aliased in both `vite.config.ts` and `tsconfig.app.json`).

**`src/App.tsx` is the whole application state.** Tasks, tags, the active view, the tag filter, the due sort, and the draft task all live in `useState` there and are passed down as props. "Navigation" is the `ViewId` union (`tasks | calendar | pomodoro | completed | tags`) plus `openTagId` for the tag detail page — adding a screen means extending that union and the render ladder at the bottom of `App.tsx`, not adding a route.

**`src/lib/` holds the domain logic; components stay presentational.** Each module owns one slice of persisted state and exports pure helpers plus its own `load*`/`save*`:

- `lib/tasks.ts` — `Task`, due-date parsing/formatting, sorting, completion retention.
- `lib/tags.ts` — `Tag`, the 30-colour palette, WCAG-based `readableTextColor`.
- `lib/pomodoro.ts` — settings, timer state, session history (types, validation, persistence only; no React).
- `lib/calendar.ts` — the week/month scope, grid building, grouping tasks by local day.
- `lib/sync.ts` — `SyncMeta` (`updatedAt`/`deletedAt`), the last-write-wins `mergeById`, tombstone helpers.
- `lib/backup.ts` — the JSON export/import file format, its validator, and the merge/replace rule.
- `lib/appearance.ts` — the accent id and the display-size step, plus the two lines that put them on the document.
- `lib/guide.ts` — the welcome guide's `seen` flag and the first-run rule that decides whether it opens itself.
- `lib/releases.ts` — the changelog (`RELEASES`, newest first) and `releasesSince`. The list is the git log: `scripts/git-releases.ts` is a Vite plugin that serves it as `virtual:releases` at build time (typed in `src/virtual-releases.d.ts`), one entry per commit with the hash as id, the subject minus its `type(scope):` prefix as title, and the body paragraphs as notes. It hides `chore`, `ci`, `build`, `docs`, `refactor`, `style`, `test` and `revert` commits, so a deploy made only of those announces nothing. **The commit message is the release note**: write the subject and body for a reader of the app. The deploy workflow checks out with `fetch-depth: 0` for this.
- `lib/whats-new.ts` — the last-seen release id and the opt-out, plus `shouldAnnounceRelease`, which is quiet on a first visit (nothing to have changed from) and when muted.

**localStorage is the only persistence.** Keys are versioned: `marzano.tasks.v1`, `marzano.tags.v1`, `marzano.due-sort.v1`, `marzano.calendar-scope.v1`, `marzano.theme.v1`, `marzano.accent.v1`, `marzano.zoom.v1`, `marzano.sidebar.v1`, `marzano.guide.v1`, `marzano.whats-new.v1`, `marzano.pomodoro.{settings,timer,history}.v1`. Every module reads through a tolerant `toX()` validator that coerces missing or corrupt fields to defaults rather than discarding the record (only records with no usable identity are dropped), and every write is wrapped in try/catch so the app still runs when storage is unavailable. **When you add a field to `Task`, `Tag`, or `PomodoroSettings`, extend the corresponding validator — anything it does not read is silently lost on the next load.** App-level `useEffect`s save each state slice on change; components never touch localStorage.

### Records carry sync bookkeeping

`Task` and `Tag` extend `SyncMeta` from `lib/sync.ts`: `updatedAt` (ISO, stamped on every change) and `deletedAt` (ISO, or null). Nothing but the JSON import reads them today; they exist now because they cannot be backfilled — records written without them have no way to say which copy is newer, and a hard delete is indistinguishable from a record another browser has not seen yet.

- **Never spread a change into a record directly.** `{ ...task, completedAt }` skips the stamp. Use `touchTask` / `touchTag`, which are `touch` from `lib/sync.ts`.
- **Deleting writes a tombstone**, not a `filter`. `tombstone(record)` keeps the id and stamps both fields, so the deletion survives a merge; a hard delete would let the other copy put the record back. `purgeTombstones` drops them after `TOMBSTONE_RETENTION_DAYS` (90).
- Completed tasks past `COMPLETED_RETENTION_DAYS` become tombstones rather than vanishing, stamped with the moment they expired so every browser lands on the same record.
- `App.tsx` derives `presentTasks` / `presentTags` and passes those down; components never see a tombstone. `isActiveTask` and `tagsById` filter them out too.
- `mergeById` is the whole merge rule — last-write-wins per id, ties keeping the local copy. A sync layer would call the same function on a server response.

### Due dates

`Task.dueAt` is a union encoded in a string: either `yyyy-MM-dd` (day-only, comes due at *end* of that local day) or a full ISO instant. Never call `new Date(task.dueAt)` directly — use `dueAtToDate`, `dueAtToDeadline`, and `formatDueDate` from `lib/tasks.ts`, which branch on `isDateOnlyDue`.

`dueUrgency` in `lib/tasks.ts` grades a due value `overdue | today | tomorrow | soon | later` (overdue agrees with `isTaskDue`; the rest are local calendar days, `soon` being the coming week), and `components/task-due-date.tsx` maps that to a text colour: `destructive` for overdue, `muted-foreground` for later, and the `--due-today|tomorrow|soon` tokens in `index.css` between. `hooks/use-today.ts` is one shared `useSyncExternalStore` that ticks past local midnight and on focus/visibility, so every "today" label turns over together; render every due date through `TaskDueDate` (or `DueDateText` where there is no room for the icon) rather than `text-muted-foreground`.

### Manual order and reordering

The order of the `tasks` array is the manual order: "Manual order" in the due sort menu shows it as is, and the two date sorts are stable over it. There is no position field, so a JSON *merge* keeps the device's order (`mergeById` never reshuffles) and only a *replace* carries the file's. Reordering goes through `reorderTasks` in `lib/tasks.ts`, which takes positions in the list *as shown* and permutes only the affected tasks within the stored slots they already hold -- that is what keeps a filtered list from disturbing hidden tasks and a sorted list reproducing the order just made. Under a date sort, `reorderBounds` limits a task to the run of tasks sharing its exact deadline; `TaskList` enforces that for both drag (motion's `Reorder`, dragged from the grip handle only) and keyboard (arrow keys on the handle).

### Background timers

Both `use-due-reminders.ts` and `use-pomodoro.ts` schedule far-future work with the same pattern: `setTimeout` delays are clamped to `MAX_TIMER_DELAY` (~24.8 days, the 32-bit limit) and re-armed, and both also recheck on `window.focus` / `visibilitychange` so a tab left open or backgrounded catches up. `use-completed-cleanup.ts` sweeps expired completed tasks the same way (hourly plus on visibility), and `purgeExpiredTasks` also runs inside `loadTasks`. Completed tasks are kept `COMPLETED_RETENTION_DAYS` (30) then deleted.

### Calendar

`components/calendar-page.tsx` lays the open tasks out on the days they are due, over the pure grid maths in `lib/calendar.ts`. There is no calendar library: `date-fns` builds the grid and `react-day-picker` stays where it belongs, inside the due date picker.

- A month is always six weeks, so the grid never changes height; a week is one row of taller cells.
- The cells are a preview -- coloured dots below `sm`, task names above it -- and the day panel underneath is a plain `TaskList`, so a task is completed, edited and deleted there exactly as it is on the task page.
- Which day is selected and where the calendar is scrolled to are the page's own state and start again at today; only the scope is persisted.
- The grid is a `role="grid"` with a roving `tabIndex`, so it costs one tab stop rather than 42. Arrow keys, Home/End and PageUp/PageDown move the selection, and the anchor only follows when the day moves off the grid.

### Pomodoro

`hooks/use-pomodoro.ts` is the controller (~800 lines) over the pure state in `lib/pomodoro.ts`, and returns a `PomodoroController` consumed by `components/pomodoro-page.tsx`.

- Elapsed time is derived from wall-clock timestamps (`activeStartedAt` + `accumulatedMs`), never from counting ticks, so a reload or a sleeping machine reconstructs the correct state.
- `finishExpiredTimer` walks forward through however many phase boundaries elapsed while the tab was away, bounded by `MAX_CATCH_UP_TRANSITIONS`.
- Each focus phase carries a `sessionId`; history de-duplicates on it, which is what keeps StrictMode's double-invoke from inflating statistics.
- The hook mirrors `settings`/`timer`/`tasks`/`onAddFocusTime` into refs so its callbacks stay referentially stable while still reading current values.
- Focus time flows back to tasks: the hook calls `onAddFocusTime`, which `App.tsx` turns into `Task.focusedMs` — the one place Pomodoro writes into the task list. `pomodoro.detachCompletedTask(id)` must be called before completing or deleting a task.

### UI conventions

- `src/components/ui/` is shadcn/ui-generated — regenerate rather than hand-edit where practical. `dialog`, `alert-dialog`, `sheet`, `label`, and `button` use Radix; `checkbox`, `switch`, `calendar` (react-day-picker), `number-combobox`, and `sonner` are local.
- `duration-picker` came from a third-party registry (`shadcn add swamimalode07/rare-ui/duration-picker`) and is **not** regenerable — it was retokenised, given field labels and focus rings, had its controlled `value` prop removed, and had its measurement rewritten (below). Re-running the command would undo all of that. It brings `motion`, `flubber` and `figma-squircle` (~63 kB gzip), so it earns its keep only while something uses it — the Pomodoro settings durations do.
- `squircle-segment.tsx` is the shared surface under both segmented controls (the duration picker, the due dialog's time field). Three rules it exists to hold in one place: measure with `ResizeObserver`'s `borderBoxSize`, never a bounding rect, which is transform-aware — a segment that scales itself while pressed would freeze that shrink into its clip path; overlap touching segments by `SEAM_OVERLAP`, because two anti-aliased clip edges meeting on a fractional pixel show the page through as a hairline; and draw focus rings inwards with `SEGMENT_FOCUS_RING`, because `clip-path` also clips descendants. That last point is why the time field puts the segment *behind* the controls (`absolute inset-0`, controls `relative`) rather than around them — a combobox list inside the clip would be cut off. `SEGMENT_FOCUS_RING` keeps `focus-visible:outline-solid`: Tailwind v4's `outline-none` sets `--tw-outline-style: none`, which `outline-2` then reads back, so without it the ring resolves to no outline at all.
- **Focus is one recipe; selection is another.** Every focusable control carries shadcn/ui's current ring — `outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/70`, no offset — so the halo hugs the control and takes the accent through `--ring` instead of drawing a second black outline around it; `input` adds the `aria-invalid:` pair on top, and it is ordered after the focus classes on purpose, so an invalid field stays red while focused. Three deliberate exceptions: a row inside a popover or a scroller takes the menu treatment (`focus-visible:bg-accent` plus `focus-visible:inset-ring-2`), because an outset ring is clipped by the container it sits in — note Tailwind v4 dropped `ring-inset` for `inset-ring-*`; a control whose hit area is far bigger than its mark (`checkbox`, `switch`) rings the mark through `group-focus-visible:` rather than floating a halo around 2.75rem of empty space; and a colour swatch focuses with an *outline*, because its selected state is already a ring and arrowing the row moves selection with focus, so a second ring would only overwrite the first.
- **Motion is one curve at two lengths, defined once.** `@theme` in `index.css` holds `--ease-out-cubic`, `--transition-duration-fast` (150ms: hover, press, colour, every exit) and `--transition-duration-base` (200ms: enter, move, reveal), and `lib/motion.ts` restates the same three values for `motion` (`TRANSITION.fast|base`, plus the `popoverMotion` and `listRowMotion` presets); change one and change the other. Anything that answers the pointer or a state change takes `transition-ui`, a single `@utility` in `index.css` — never a hand-written `transition-[…] duration-* ease-*` — and it lists `translate, scale, rotate` explicitly because Tailwind v4's `scale-*` writes the `scale` property, not `transform`, so a list that only says `transform` lets a pressed button snap. Every overlay has a paired exit (`data-[state=closed]:animate-*-out`, with `both` so the last frame holds until Radix unmounts); the non-Radix menus and comboboxes get theirs from `AnimatePresence` + `popoverMotion`. List rows (`task-list`, `completed-task-list`) grow and collapse through `listRowMotion`, which is why their padding sits on an inner box and why `hooks/use-animating.ts` clips overflow only for the duration. The view switch is a keyed wrapper with `animate-view-in` (entrance only, no dead time), and a theme or accent change runs under `crossfadeDocument`, which sets `data-theme-transition` on the root for one `base` length — it fires only when the document actually changes, which is what keeps the first paint still. `MotionConfig` in `main.tsx` is the one place that decides about reduced motion for JS animations (`reducedMotion="user"`), and the `prefers-reduced-motion` block in `index.css` does the same for CSS; never call `useReducedMotion` per component. `ui/duration-picker.tsx` is the deliberate exception and keeps its own springs.
- `ui/segmented-control.tsx` is the one-of-n row (the calendar range, the theme choice): a real radiogroup — one tab stop, arrow keys walk it — whose selected pill is a single `motion` element moved between segments by `layoutId`, so it slides rather than blinking out and back in. `useId` scopes that id per instance, and the transition comes from `MotionConfig` like every other JS animation. Two knobs keep it usable where it does not own the screen: `variant="raised"` lifts the selected segment off the track instead of filling it with the accent, for a control that is on screen permanently (the sidebar footer) rather than being read once (the settings dialog); `iconOnly` drops the labels to `sr-only` plus a title, for a row too narrow to spell them out.
- Dropdowns that are not Radix popovers (`due-sort-menu`, `tag-filter-menu`) share `hooks/use-menu-dismiss.ts` for outside-pointer / focus-out / Escape dismissal.
- Toasts are `sonner` (`toast.*`); the completion toast carries the Undo action. A `sr-only` `aria-live` region at the bottom of `App.tsx` announces every mutation via `setStatusMessage` — keep new mutations announcing there.
- `guide-dialog.tsx` is the only dialog `App` opens rather than one carrying its own trigger: a first run with nothing stored opens it once (`shouldOpenGuide`), and the sidebar's Guide button and the empty task list open it again. Closing it any way at all records the answer, so it never introduces itself twice. Its title is `sr-only` and each step's own heading is the visible one, which is what lets the card animate without unmounting the name Radix labels the dialog with.
- `whats-new-dialog.tsx` is the changelog, opened from the sidebar and from the toast `hooks/use-whats-new.ts` raises on the first load after a new visible commit lands in `RELEASES`. A toast rather than a dialog on purpose: the app is opened daily and a changed build is not a reason to block the list. The hook reads storage once, stamps the current build immediately (so a reload is quiet whatever happened to the toast), and keeps the releases that were unseen *at load* until the dialog is closed, which is what the dialog's "New" badges and the sidebar dot read: closing is when the list counts as read, so the badges last through the first look and are gone on the next. The opt-out is the same `muted` flag from the dialog's checkbox and the Settings switch.
- Dialogs that open onto a text field call `focusDialogTitleOnTouch` (`lib/utils.ts`) so the on-screen keyboard does not cover the content.
- Theme: light and dark. Colours are HSL channel triples in `@layer base` in `src/index.css` — `:root` for light, `:root.dark` for dark — exposed to Tailwind via `@theme` (Tailwind v4 CSS-first config — there is no `tailwind.config.js`). `lib/theme.ts` owns the preference (`system | light | dark`) and is the only place that touches the `.dark` class, `color-scheme`, and the `theme-color` meta; `hooks/use-theme.ts` wraps it for `App.tsx`, and an inline script in `index.html` applies the same rule before first paint. **Style from the tokens, never from a raw colour**: shadows and the dialog overlay are tokens too (`shadow-card|popover|dialog|toast|thumb|swatch`, `bg-overlay`), because black shadows disappear on a dark page. Reach for the `dark:` variant only where a surface has to move rather than recolour (dialogs climb from `bg-background` to `bg-popover`).
- Accent and display size (`lib/appearance.ts`, `hooks/use-appearance.ts`, both surfaced by `components/settings-dialog.tsx`). The accent is a name on `:root[data-accent]`, never a colour in TypeScript: each one restates `--primary`, `--primary-foreground` and `--ring` in `index.css`, once per theme, and the same rule paints the `[data-swatch]` preview in Settings, so adding an accent means adding its id to `ACCENTS` and its three rules to the stylesheet. `graphite` is the neutral default and has no block. Display size is the root `font-size`, which is why everything is sized in `rem` and why `body`'s floor is `min-width: 320px` in pixels — a rem floor would grow with the setting. Both are applied by the pre-paint script in `index.html` as well, or the page lays itself out twice.
- The brand mark is `lib/brand.ts`: one path whose check is a reverse-wound hole, so it needs no mask and shows whatever is behind it. `components/brand-mark.tsx` draws it in `currentColor`, and the sidebar and the guide's welcome card give it `text-primary` so it follows the accent. The favicon set in `public/` (`favicon.svg`, which follows the colour scheme; `favicon.ico` for Safari and older browsers; the PNG tiles behind `apple-touch-icon` and `manifest.webmanifest`) is rendered from the same path by `pnpm icons` and committed, because the deploy has no render step. Change the mark in `brand.ts` and re-run it; never hand-edit the rasters.
- Files are kebab-case; components use named exports (often re-exported at the bottom of the file). Comments in this codebase explain *why* a decision was made, not what the code does — match that register.
