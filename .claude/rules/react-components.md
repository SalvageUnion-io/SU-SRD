---
paths:
  - '**/*.tsx'
---

# React Components

React component patterns using functional components and TypeScript.

## Component Structure

- Use functional components with TypeScript
- Define props types at the top of the file
- Named exports (Biome's `noDefaultExport`; route modules export `Route`, see `tanstack-router.md`)

## Component Organization

Shared, app-agnostic components live in `packages/component-lib/src/components/`;
reach for the library first. Read the barrel (`packages/component-lib/src/index.ts`)
and `docs/architecture/package-contracts.md` for what lives where, never a
hand-written inventory. App-only components live in that app's
`src/components/{feature}/`.

## UI Frameworks

**srd** uses React 19 rendered by an in-house SSG (`apps/srd/ssg`; contract in `apps/srd/CLAUDE.md`):

- Shared components imported from `component-lib` package
- Tailwind v4 with theme from component-lib
- Pages are `src/pages/**/*.page.tsx` modules registered in `ssg/routes.ts`
- Interactive components are islands: `<Island name="X" client="idle" …/>` emits
  a placeholder, and `src/runtime/islands.client.ts` mounts it with
  **`createRoot`, never `hydrateRoot`**. Client strategies are `load`, `idle`,
  `visible`, `only`.
- **No `.css` import may be reachable from an SSR module** — all css goes through
  `src/runtime/styles.entry.ts`. See `apps/srd/ssg/DESIGN.md`.

**itun** uses React 19 + Vite + Tailwind v4:

- UI primitives come from `component-lib` (`ui/`, `chrome/`, `base/`), not from
  an app-local `src/components/ui/` — there is no such directory. Underneath,
  the primitive layer is **Base UI** (`@base-ui/react`) plus `lucide-react`,
  `class-variance-authority` and `sonner`. The repo does **not** depend on
  Radix.
- Data access follows the two-domain seam in
  [`itun-data-access.md`](itun-data-access.md): Zustand stores for
  player entities, Convex hooks for accounts/Games/ownership. React Context is
  fine and is used (`ConnectionProvider`, `EntityHrefProvider`) — prefer props
  where props suffice, not as an absolute ban.
- Validation via Zod schemas in `src/lib/schemas/`

**component-lib** (shared components):

- No build step - exports TypeScript source directly
- Styling: tokens + `.su-*` classes, Tailwind being removed — see
  `docs/design-system/tailwind-removal.md`; `bun run check styling` rejects new Tailwind files
- Two card shells, not a layered stack: `ReferenceEntityCard` for SRD game data
  and `Card` for everything else. See
  [`display-system.md`](display-system.md) and
  `docs/architecture/display-system.md`. There is no render-prop layer.
- No backend dependency - agnostic to data source
- Design tokens live only in `packages/component-lib/src/styles/theme.css`; an
  app declaring its own fails `bun run check styling` (`app-theme`; also
  `dead-app-css`, `pc-class-contract` in `tools/rules/stylingOwnership.ts`). Its
  one exemption, the `--animate-loader-slide` binding in `apps/itun/src/index.css`,
  covers only the no-`@theme` clause, never a reserved-namespace token.

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
