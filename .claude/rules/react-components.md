---
paths:
  - "**/*.tsx"
---

# React Components

React component patterns using functional components and TypeScript.

## Component Structure

- Use functional components with TypeScript
- Define props types at the top of the file (use `type` over `interface`)
- Use named exports for components (not default exports)
- Exception: Route components in `src/routes/` can use default exports for TanStack Router

## Component Organization

- `src/components/shared/` - Reusable UI components
- `src/components/{FeatureName}/` - Feature-specific components
- `src/components/base/` - Typography and foundational components
- `src/components/entity/` - Entity display and selection components

## UI Frameworks

**suref-web** uses Astro 5 with React 19 islands:
- Shared components imported from `suref-react` package
- Tailwind v4 with theme from suref-react
- React islands hydrated via `client:load` or `client:visible` directives

**in-the-union-now** uses ShadCN + Tailwind v4:
- Use ShadCN components from `src/components/ui/`
- Custom Tailwind theme in `src/index.css` with `@theme` block (SU brand colors)
- State management via Zustand stores + TanStack Query (no React Context)
- Validation via Zod schemas in `src/lib/validation.ts`

**suref-react** (shared components):
- No build step - exports TypeScript source directly
- Uses Tailwind + `cn()` utility for styling
- Entity display system with render prop pattern
- No Supabase dependency - agnostic to data source

## State Management

- Prefer props over context when possible
- Use TanStack Query hooks for server state
- Use Zustand stores for shared client state (ITUN)
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
