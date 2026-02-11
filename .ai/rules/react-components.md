# React Components

> **Applies to:** `apps/suref-web/` (Chakra UI v3), `apps/in-the-union-now/` (ShadCN + Tailwind v4), `packages/suref-react/` (shared components)

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

**suref-web** uses Chakra UI v3:
- Use Chakra components from `@chakra-ui/react`
- Use theme system defined in suref-react theme
- Use theme colors: `su.green`, `su.lightBlue`, `su.mediumGrey`, etc.

**in-the-union-now** uses ShadCN + Tailwind v4:
- Use ShadCN components from `src/components/ui/`
- Custom Tailwind theme in `src/index.css` with `@theme` block (SU brand colors)
- State management via Zustand stores + TanStack Query (no React Context)
- Validation via Zod schemas in `src/lib/validation.ts`

**suref-react** (shared components):
- No build step — exports TypeScript source directly
- Uses Tailwind + `cn()` utility for styling
- Entity display system with render prop pattern
- No Supabase dependency — agnostic to data source

## Entity Display Components

- Use `EntityDisplay` for showing reference data
- Use `EntitySelectionModal` for selecting entities
- Support pattern selection via URL query params when applicable

## State Management

- Prefer props over context when possible
- Use TanStack Query hooks for server state
- Use Zustand stores for shared client state (ITUN)
- Use React state for local UI state

## Import Conventions

Prefer relative imports for all imports:

```typescript
// Correct
import { MyComponent } from '../../components/MyComponent'

// Avoid
import { MyComponent } from '@/components/MyComponent'
```

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
