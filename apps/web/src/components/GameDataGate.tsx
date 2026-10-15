import type { CSSProperties, ReactNode } from 'react'
import { fontSize, space } from '../design/tokens'
import type { Projection, SchemaList } from '../lib/useGameData'
import { useGameData } from '../lib/useGameData'
import { Button } from './index'

const FAILED = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: space[16],
} satisfies CSSProperties

const FAILED_MESSAGE = {
  fontSize: fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

/**
 * Gate component — renders children only after game data is preloaded.
 * Use this to wrap island content that depends on ORM calls.
 * On preload failure it renders a retry affordance instead of the fallback,
 * so a network error never leaves a permanent skeleton.
 */
export function GameDataGate({
  children,
  fallback,
  schemas,
  projection,
}: {
  children: ReactNode
  fallback?: ReactNode
  /** Which schemas to preload — defaults to `'all'`. See `useGameData`. */
  schemas?: SchemaList
  /** Which copy of each schema — defaults to `'full'`. See `useGameData`. */
  projection?: Projection
}) {
  // useGameData keys its preload effect off `keyFor(schemas)` (content-, not
  // reference-based), so a fresh `[...]` array literal each render is safe.
  const { ready, error, retry } = useGameData({ schemas, projection })
  if (error) {
    return (
      <div style={FAILED}>
        <p style={FAILED_MESSAGE}>Failed to load game data.</p>
        <Button variant="ghost" onClick={retry}>
          Retry loading game data
        </Button>
      </div>
    )
  }
  if (!ready) return fallback ?? null
  return children
}
