---
paths:
  - '**/*.tsx'
---

# React Components

React component patterns using functional components and TypeScript.

## Component Structure

- Use functional components with TypeScript
- Define props types at the top of the file (use `type` over `interface`)
- Use named exports for components (not default exports)
- Exception: Route components in `src/routes/` can use default exports for TanStack Router

## Component Organization

Shared, app-agnostic components live in `packages/component-lib/src/components/`
(`base/`, `chrome/`, `shared/`, `stat/`, `ui/`, `referenceEntity/`, `sheet/`,
`dashboard/`, `skeleton/`, `wizard/`). Reach for the library **first** — see
`docs/architecture/package-contracts.md` for what lives where, and read the
barrel (`packages/component-lib/src/index.ts`) rather than trusting any
hand-written inventory.

Inside an app:

- `src/components/shared/` — app-wide components that are not library-worthy
  (app router glue, providers, gates)
- `src/components/{feature}/` — feature-scoped components. In itun these are
  lowercase feature folders: `account/`, `container/`, `contextual/`,
  `crawler/`, `dashboard/`, `encounter/`, `export/`, `games/`, `mech/`,
  `pilot/`, `roster/`, `sheet/`, `wiring/`, `wizard/`.

## UI Frameworks

**srd** uses React 19 rendered by an in-house SSG (`apps/srd/ssg`), not Astro:

- Shared components imported from `component-lib` package
- Tailwind v4 with theme from component-lib
- Pages are `src/pages/**/*.page.tsx` modules registered in `ssg/routes.ts`
- Interactive components are islands: `<Island name="X" client="idle" …/>` emits
  a placeholder, and `src/runtime/islands.client.ts` mounts it with
  **`createRoot`, never `hydrateRoot`**. Client strategies are `load`, `idle`,
  `visible`, `only`. There are no `client:*` directives — those were Astro's.
- **No `.css` import may be reachable from an SSR module** — all css goes through
  `src/runtime/styles.entry.ts`. See `apps/srd/ssg/DESIGN.md`.

**itun** uses React 19 + Vite + Tailwind v4:

- UI primitives come from `component-lib` (`ui/`, `chrome/`, `base/`), not from
  an app-local `src/components/ui/` — there is no such directory. Underneath,
  the primitive layer is **Base UI** (`@base-ui/react`) plus `lucide-react`,
  `class-variance-authority` and `sonner`. The repo does **not** depend on
  Radix.
- Data access follows the two-domain seam in
  [`tanstack-query-hooks.md`](tanstack-query-hooks.md): Zustand stores for
  player entities, Convex hooks for accounts/Games/ownership. React Context is
  fine and is used (`ConnectionProvider`, `EntityHrefProvider`) — prefer props
  where props suffice, not as an absolute ban.
- Validation via Zod schemas in `src/lib/schemas/`

**component-lib** (shared components):

- No build step - exports TypeScript source directly
- Uses Tailwind + `cn()` utility for styling
- Two card shells, not a layered stack: `ReferenceEntityCard` for SRD game data
  and `Card` for everything else. See
  [`display-system.md`](display-system.md) and
  `docs/architecture/display-system.md`. There is no render-prop layer.
- No backend dependency - agnostic to data source

## Styling ownership (CI-enforced)

**All design tokens live in `packages/component-lib/src/styles/theme.css`.** An
app must not declare an `@theme` block or define a `--color-*` / `--text-*` /
`--tracking-*` / `--bw-*` / `--radius-*` / `--font-*` / `--shadow-*` token.
`tools/check-styling-ownership.ts` (rule `app-theme`) fails on it, and it runs
in `check:all` and at **pre-push** via lefthook — so a violation surfaces late,
after the code is written.

There is exactly one exemption, listed in that file: the
`--animate-loader-slide` keyframe binding in `apps/itun/src/index.css`. It
exempts only the "no `@theme` in an app" clause — adding a reserved-namespace
token inside it still fails.

Two related rules from the same checker: authored app CSS must have a consumer
(`dead-app-css`), and the dashboard `pc-*` class contract is closed in both
directions (`pc-class-contract`).

## State Management

- Prefer props over context when possible
- Use Zustand stores for shared persistent client state (ITUN)
- Use Convex `useQuery`/`useMutation` for account/Game/ownership server state
- Use React state for local UI state

## Examples

**Component with props:**

```typescript
type MyComponentProps = {
  id: string
  isEditable?: boolean
}

export function MyComponent({ id, isEditable = false }: MyComponentProps) {
  // ...
}
```

**Route component (default export allowed):**

```typescript
export const Route = createFileRoute('/my-route')({
  component: MyRoute,
})

export default function MyRoute() {
  return <div>Route content</div>
}
```
