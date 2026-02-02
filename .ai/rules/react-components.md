# React Components

> **Applies to:** `apps/suref-web/src/components/**/*.tsx`, `apps/suref-web/src/routes/**/*.tsx`

React component patterns using functional components, TypeScript, and Chakra UI v3.

## Component Structure

- Use functional components with TypeScript
- Define props interfaces at the top of the file
- Use named exports for components (not default exports)
- Exception: Route components in `src/routes/` can use default exports for TanStack Router

## Component Organization

- `src/components/shared/` - Reusable UI components
- `src/components/{FeatureName}/` - Feature-specific components
- `src/components/base/` - Typography and foundational components
- `src/components/entity/` - Entity display and selection components

## Chakra UI v3

- Use Chakra UI v3 components from `@chakra-ui/react`
- Use the theme system defined in `src/theme.ts`
- Prefer Chakra's `VStack`, `HStack`, `Flex`, `Box` for layout
- Use theme colors: `su.green`, `su.lightBlue`, `su.mediumGrey`, etc.

## Live Sheet Components

Live sheet components (PilotLiveSheet, MechLiveSheet, CrawlerLiveSheet):

- Use `LiveSheetLayout` wrapper
- Use `LiveSheetControlBar` for actions
- Use `LiveSheetLoadingState`, `LiveSheetNotFoundState`, `LiveSheetErrorState` for states
- Implement realtime subscriptions via `useLiveSheetSubscriptions`

## Entity Display Components

- Use `EntityDisplay` for showing reference data
- Use `EntitySelectionModal` for selecting entities
- Support pattern selection via URL query params when applicable

## State Management

- Prefer props over context when possible
- Use TanStack Query hooks for server state
- Use React state for local UI state
- Use `useHydrated*` hooks (e.g., `useHydratedPilot`, `useHydratedMech`) for entity data

## Import Conventions

Prefer relative imports for all imports:

```typescript
// Correct
import { useHydratedPilot } from '../../hooks/pilot'

// Avoid
import { useHydratedPilot } from '@/hooks/pilot'
```

## Examples

**Component with props:**

```typescript
interface MyComponentProps {
  id: string
  isEditable?: boolean
}

export function MyComponent({ id, isEditable = false }: MyComponentProps) {
  const { mech } = useHydratedMech(id)
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
