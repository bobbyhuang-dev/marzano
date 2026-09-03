# Security policy

Marzano is a single-page app that runs entirely in the browser. It has no
server, no accounts, and makes no network calls once loaded; everything the
user writes stays in that browser's `localStorage`. That keeps the attack
surface small, but not empty, and reports are welcome.

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's
private vulnerability reporting instead:

**https://github.com/bobbyhuang-dev/marzano/security/advisories/new**

Include what you found, how to reproduce it, and what an attacker could do
with it. A minimal backup file or a task name that triggers the issue is the
most useful thing you can attach.

This is a one-person project, so there is no formal SLA. Expect an
acknowledgement within a few days and a fix or a considered answer as soon as
one is ready. Please give a fix time to ship before disclosing publicly; the
production site deploys from `main`, so a merged fix is live within minutes.

## Supported versions

There are no numbered releases. The only supported version is the current
deployment at [marzano.bobbyhuang.dev](https://marzano.bobbyhuang.dev), which
is always the tip of `main`. A report against an older commit is still useful
if it reproduces on the current build.

## What is in scope

- Script or HTML injection through anything a user can type or import: task
  names, tag names, and above all the JSON backup import.
- A backup file that crashes the app, hangs it, or corrupts the stored data
  rather than being rejected by the validator.
- A vulnerability in a dependency that is reachable from the shipped bundle.
- The deploy pipeline in `.github/workflows/deploy.yml` and its Cloudflare
  configuration in `wrangler.jsonc`.
- Anything that would make the app send data off the device. It is not meant
  to have a network path at all.

## What is out of scope

- Issues that need a compromised browser, device, or extension. Anyone who can
  read the browser's storage already has the data.
- Data loss from clearing site data or from a browser's own storage eviction.
  The app documents this, and Backup exists for it.
- Dependency advisories with no reachable path in the built app. Mention them
  in an ordinary issue instead.
- Findings from automated scanners that come without a reproduction.
- Missing response headers on the static site, unless you can show an impact.

## Handling of your data

Nothing is uploaded, tracked, or logged by the app. The only network activity
is the browser fetching the static build from Cloudflare, so there is no
server-side data to breach and no telemetry to opt out of.
