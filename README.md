# Marzano

A focused task list with due reminders, tags, and a built-in Pomodoro timer. Everything runs in the browser and is stored on your device — no account, no server, no network calls.

## Features

**Tasks** — Add a task with an optional due date and tags, edit or delete it inline, and check it off. Completing a task raises a toast with an Undo action.

**Due dates and reminders** — A due date can be a day (`Fri, Mar 14`) or a day and time. Day-only tasks come due at the end of that day. When a task falls due the app raises a reminder, including on a tab that has been left open or in the background. The date picker has Tomorrow / Next week shortcuts and an optional time.

**Sorting and filtering** — Order open tasks by deadline in either direction (undated tasks always sit at the bottom) or keep the order you entered them in. Filter the list down to one or more tags. The sort is remembered between sessions; the filter is not.

**Tags** — Colour-coded labels with a 30-colour spectrum palette. Each new tag is offered the first unused colour, and label text automatically renders black or white against its fill, whichever is more readable. The Tags page shows how much open and total work sits behind each tag, and each tag has its own page listing its tasks.

**Pomodoro** — A focus timer tied to your task list: pick a task, run a round, and the time is credited to that task. Configurable focus, short-break, and long-break durations, long-break interval, and optional auto-start for breaks and focus rounds. Round completion is announced with a chime, an in-app toast, and — with permission — a desktop notification. An activity panel shows today's focus time, rounds, tasks touched, and recent sessions. The timer is reconstructed from wall-clock time, so it survives a reload, a backgrounded tab, or a sleeping machine.

**Completed archive** — Checked-off tasks stay in Completed for 30 days, where they can be restored or deleted, and are then removed automatically. Tasks close to that cutoff are called out.

**Accessible and responsive** — Keyboard-navigable throughout, with every change announced to screen readers via a live region. The sidebar collapses to a sheet on small screens, and animation is dropped when the system asks for reduced motion.

## Getting started

Requires **Node 24 LTS** (the current Active LTS; `.nvmrc` pins it) and [pnpm](https://pnpm.io). Node 20.19+, 22.13+, and the current release work too — that range is declared in `package.json`.

```bash
nvm use          # or: fnm use
pnpm install
pnpm dev
```

The dev server prints a local URL. Other scripts:

```bash
pnpm build     # type-check and bundle to dist/client/
pnpm preview   # serve the production build locally
pnpm lint      # run ESLint
```

`pnpm build` produces a static `dist/client/` directory that can be served from any static host.

## Deployment

Production is hosted on Cloudflare Workers at
[`marzano.bobbyhuang.dev`](https://marzano.bobbyhuang.dev). Pushing to `main`
runs the GitHub Actions deployment workflow, which validates the app and
publishes the new build. The workflow requires the repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Marzano data stays in each browser's `localStorage`; deployments do not modify
it. When moving between different hostnames, export a JSON backup from the old
site and merge it into the new site before retiring the old hostname.

## Your data

Everything lives in your browser's `localStorage` under keys prefixed `marzano.` — tasks, tags, the due sort, and the Pomodoro settings, timer, and session history. Nothing is uploaded anywhere. The flip side is that the data is per-browser and per-device: clearing site data erases it, and there is no sync between browsers. Desktop alerts additionally need notification permission, which the Pomodoro settings will ask for.

## Built with

React 19, TypeScript, and Vite. Styling is Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com) components on Radix primitives; icons are [Lucide](https://lucide.dev), toasts are [Sonner](https://sonner.emilkowal.ski), date handling is [date-fns](https://date-fns.org), and the calendar is [React DayPicker](https://daypicker.dev).

## Project layout

```
src/
  App.tsx          application state and view switching
  components/      feature components
  components/ui/   shadcn/ui primitives
  hooks/           due reminders, completed-task cleanup, Pomodoro controller
  lib/             task, tag, and Pomodoro domain logic and persistence
  index.css        Tailwind theme and base styles
```

`CLAUDE.md` documents the architecture in more depth — the persistence contract, the due-date encoding, and how the Pomodoro state machine works.

## License

[MIT](LICENSE) © 2026 Bobby Huang
