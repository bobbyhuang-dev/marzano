<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.svg">
    <img src=".github/assets/banner-light.svg" alt="Marzano: tasks, due reminders, tags, a calendar and a Pomodoro timer. Everything stays in your browser." width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://marzano.bobbyhuang.dev"><strong>Open the app</strong></a>
  &nbsp;·&nbsp; <a href="#features">Features</a>
  &nbsp;·&nbsp; <a href="#getting-started">Getting started</a>
  &nbsp;·&nbsp; <a href="#your-data">Your data</a>
  &nbsp;·&nbsp; <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://github.com/bobbyhuang-dev/marzano/actions/workflows/deploy.yml"><img src="https://github.com/bobbyhuang-dev/marzano/actions/workflows/deploy.yml/badge.svg" alt="Deploy status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-141414" alt="MIT license"></a>
  <a href=".nvmrc"><img src="https://img.shields.io/badge/node-24_LTS-141414" alt="Node 24 LTS"></a>
</p>

Marzano is a focused task list with due reminders, tags, a calendar, and a built-in Pomodoro timer. It runs entirely in the browser and keeps everything on your device: no account, no server, no network calls. It is a San Marzano tomato wearing a check, which is the whole pun.

## Features

**Tasks** — Add a task with an optional due date and tags, edit or delete it inline, and check it off. Completing a task raises a toast with an Undo action. Drag a row by its grip, or move it with the arrow keys, to set the order by hand.

**Due dates and reminders** — A due date is either a day (`Fri, Mar 14`) or a day and a time; day-only tasks come due at the end of that day. When a task falls due the app raises a reminder, including in a tab left open or in the background. The picker has Tomorrow and Next week shortcuts and an optional time.

**Calendar** — Open tasks laid out on the days they are due, a week or a month at a time. Pick a day to see its tasks in a list where they can be completed, edited, and deleted as on the task page, or add a task straight onto that day. The grid is one tab stop: arrow keys, Home/End and PageUp/PageDown move through it.

**Sorting and filtering** — Order open tasks by deadline in either direction, with undated tasks at the bottom, or keep your manual order. Filter the list to one or more tags. The sort is remembered between sessions; the filter is not.

**Tags** — Colour-coded labels from a 30-colour spectrum. Each new tag is offered the first unused colour, and its text renders black or white against the fill, whichever is more readable. The Tags page shows how much open and total work sits behind each tag, and every tag has its own page listing its tasks.

**Pomodoro** — A focus timer wired into the list: pick a task, run a round, and the time is credited to that task. Focus, short-break and long-break lengths, the long-break interval, and auto-start are all configurable. A finished round is announced with a chime, an in-app toast, and, with permission, a desktop notification. An activity panel shows today's focus time, rounds, tasks touched, and recent sessions. The timer is reconstructed from wall-clock time, so a reload, a backgrounded tab, or a sleeping machine cannot lose a round.

**Completed archive** — Checked-off tasks stay under Completed for 30 days, where they can be restored or deleted, and are then removed automatically. Tasks close to the cutoff are called out.

**Backup** — Export your tasks, tags and Pomodoro history as one readable JSON file, and import it in another browser. Importing merges by default, keeping whichever copy of each record was edited last, so two browsers can be brought together without losing either side. Replace is there for a clean restore.

**Appearance** — Light and dark themes that follow the system by default, seven accent colours, and a display size that scales the whole app rather than just the text. All three are applied before the first paint, so there is no flash on load.

**Guided first run** — A browser opening Marzano for the first time gets a seven-step guide: what the app is, how your data stays on your device, and one card for each view. It can be skipped and is always available again from Guide in the sidebar.

**What's new** — The first visit after an update raises a short notice with a link to the changelog. The changelog is built from the commit history at build time, lists every change newest first, and marks the ones this browser has not seen. The notice can be switched off from the changelog or in Settings.

**Accessible and responsive** — Keyboard-navigable throughout, with every change announced to screen readers through a live region. The sidebar collapses to a sheet on small screens, and animation is dropped when the system asks for reduced motion.

## Getting started

Requires **Node 24 LTS** (pinned in `.nvmrc`; 20.19+ and 22.13+ also work) and [pnpm](https://pnpm.io), which `corepack enable` provides at the pinned version.

```bash
nvm use          # or: fnm use
pnpm install
pnpm dev
```

The dev server prints a local URL. The other scripts:

```bash
pnpm build     # type-check, then bundle to dist/client/
pnpm preview   # serve the production build locally
pnpm lint      # eslint .
pnpm icons     # re-render the favicon set in public/ from src/lib/brand.ts
```

There is no test suite; `pnpm build` type-checks the whole project and is the verification gate. The output in `dist/client/` is a static site that any host can serve, with every path falling back to `index.html`.

## Deployment

Production is [marzano.bobbyhuang.dev](https://marzano.bobbyhuang.dev), served as static assets from Cloudflare Workers. Every push to `main` runs the [deploy workflow](.github/workflows/deploy.yml), which lints, builds, and publishes; a merged change is live within minutes. The workflow needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and it checks out the full history because the changelog is built from the git log.

Deployments never touch user data, which lives in each browser. When moving between hostnames, export a backup from the old site and import it into the new one before retiring the old hostname.

## Your data

Everything lives in your browser's `localStorage` under keys prefixed `marzano.`: tasks, tags, the sort and calendar range, the theme, accent and display size, the sidebar width, the guide and update flags, and the Pomodoro settings, timer, and session history. Nothing is uploaded anywhere.

The flip side is that data is per browser and per device. Clearing site data erases it, and there is no sync between browsers; Backup is how data travels. Desktop alerts need notification permission, which the Pomodoro settings will ask for.

## Built with

React 19, TypeScript, and Vite. Styling is Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) components on Radix primitives. Icons are [Lucide](https://lucide.dev), toasts are [Sonner](https://sonner.emilkowal.ski), animation is [Motion](https://motion.dev), date handling is [date-fns](https://date-fns.org), and the date picker is [React DayPicker](https://daypicker.dev).

## Project layout

```
src/
  App.tsx          application state and view switching
  components/      feature components
  components/ui/   shadcn/ui primitives
  hooks/           due reminders, completed-task cleanup, Pomodoro controller, theme, updates
  lib/             tasks, tags, calendar, Pomodoro, backup, sync, and their persistence
  index.css        Tailwind theme, colour tokens, and motion
scripts/
  git-releases.ts  Vite plugin that turns the git log into the changelog
  render-icons.mjs renders public/ from the brand mark
```

[`CLAUDE.md`](CLAUDE.md) documents the architecture in depth: the persistence contract, the due-date encoding, the sync bookkeeping behind Backup, and how the Pomodoro state machine works.

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the setup, the checks to run, and why commit messages double as release notes. Security problems go through [SECURITY.md](SECURITY.md) rather than a public issue.

## License

[MIT](LICENSE) © 2026 Bobby Huang
