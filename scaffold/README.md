# scaffold/ — THROWAWAY dev scaffold (#239)

Everything under this top-level `scaffold/` directory is **throwaway**. It exists
only to help develop and review the Crawler-bay / yitun-revamp work. It is **not**
part of the shipped product and **must be deleted before #239 merges**.

This directory is deliberately **outside the Bun workspaces** (`apps/*`,
`packages/*`) and outside the root/app `tsconfig`, `eslint`, and `knip` scopes,
so it cannot affect `bun run build`, `bun run build:itun`, typecheck, lint, or
knip for the real packages.

> Note: there is a separate, app-scoped scaffold at
> `apps/in-the-union-now/scaffold/` (the dev seed + seed IDs). That one is
> intentionally inside the ITUN app. This top-level `scaffold/` is the standalone
> tooling that lives outside any workspace.

## flow-gallery/ — standalone screenshot walkthrough (Slice H)

A dependency-light static web app that presents the captured ITUN flow
screenshots as a clickable walkthrough, grouped by flow (Overview / Pilot / Mech
/ Crawler / Snapshot). Each shot is captioned with its flow, step, and viewport
(desktop / mobile), with click-to-zoom and prev/next (arrow keys, `Esc` to
close).

It is a single `index.html` (vanilla JS) plus a generated `manifest.json`. No
build step, no npm install, no framework.

### 1. Capture the screenshots (Slice G)

From the ITUN app, run the flow-capture helper against a running dev server:

```bash
# terminal 1: dev server
bun run dev:itun

# terminal 2: capture (writes apps/in-the-union-now/.tmp-shots/flow-gallery/*.png)
cd apps/in-the-union-now
bunx playwright test --project=chromium --workers=1 --retries=0 e2e/flow-gallery.helper.ts
```

### 2. Stage the shots into the gallery

```bash
cp apps/in-the-union-now/.tmp-shots/flow-gallery/*.png scaffold/flow-gallery/shots/
```

### 3. Generate the manifest

```bash
node scaffold/flow-gallery/gen-manifest.mjs
```

This scans `shots/*.png`, pairs desktop/mobile viewports, groups by flow, and
writes `scaffold/flow-gallery/manifest.json`.

### 4. Serve the gallery (its own port, any static server)

```bash
# option A: serve (Node)
bunx serve scaffold/flow-gallery
# option B: Python
python3 -m http.server -d scaffold/flow-gallery 8080
```

Then open the printed URL (e.g. <http://localhost:8080>). The page fetches
`manifest.json` and renders the walkthrough. If no manifest is present it shows
inline instructions for steps 2–3.

> Opening `index.html` directly via `file://` will not work because the page
> `fetch()`es `manifest.json` and the PNGs — use a static server.

## Removal checklist (before #239 merges)

- Delete this entire `scaffold/` directory.
- Delete `apps/in-the-union-now/scaffold/` (dev seed + seed IDs).
- Delete `apps/in-the-union-now/e2e/flow-gallery.helper.ts`.
- Delete `apps/in-the-union-now/.tmp-shots/`.
- Delete the dev-only route `apps/in-the-union-now/src/routes/dev.tsx` (if present),
  then regenerate the route tree (`apps/in-the-union-now/src/routeTree.gen.ts`) so
  the `/dev` route is removed.
- Revert the `apps/in-the-union-now/tsconfig.json` `include` edit (remove the
  `"scaffold/**/*"` glob added for the app-scoped scaffold).
