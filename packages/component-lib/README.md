# component-lib

Shared React component library for the SURef monorepo. Consumed by `apps/srd` and `apps/itun`.

## Design constraints

- **No build step.** Exports TypeScript source directly via `src/index.ts`. Consuming apps compile it with their own Vite setup — and in `srd` the same source is also executed under Bun by the SSG's SSR pass, with no bundler at all.
- **No backend dependency.** Data-source agnostic. Apps pass data in; the library renders it.
- **Reusable across a statically generated site and a dynamic React SPA.** No framework-specific hooks that assume SSR, routing, or auth.
- **Never import `.css` from a component `srd` renders on the server.** `srd`'s SSR pass does not go through Vite, so a stylesheet import reachable from it breaks that build (`apps/srd/ssg/DESIGN.md`, hard rule 1).

## Contents

The export surface is **not enumerated here.** [`src/index.ts`](src/index.ts) is
the public API and the only trustworthy roster — read it rather than a
hand-maintained list, which drifts silently every time a component lands or is
deleted (this README's list had grown six names that no longer existed).

- **The barrel** — [`src/index.ts`](src/index.ts): every export, in one file.
- **The catalog** — `bun run ladle` from the repo root: every public visual
  component, rendered with real SRD data.
- **The rules** — [package-contracts.md](../../docs/architecture/package-contracts.md):
  what may be exported and what consumers may import.

## Consuming

Workspace dependency:

```json
"component-lib": "workspace:*"
```

Import from the barrel — every name below is exported from
[`src/index.ts`](src/index.ts):

```ts
import { Card, ReferenceEntityCard, Text } from 'component-lib'
```

## Scripts

| Script                             | What it does                        |
| ---------------------------------- | ----------------------------------- |
| `bun --filter component-lib test`  | Run component tests (happy-dom)     |
| `bun --filter component-lib ladle` | Launch Ladle for component browsing |
| `bun run typecheck`                | Typecheck (from repo root)          |

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — conventions for this package
- [`/docs/architecture/display-system.md`](../../docs/architecture/display-system.md) — 3-layer render stack
- [`/docs/architecture/package-contracts.md`](../../docs/architecture/package-contracts.md) — package API rules
