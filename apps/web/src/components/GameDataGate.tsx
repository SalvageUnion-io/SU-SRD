import type { CSSProperties, ReactNode } from 'react'
import { space } from '../design/tokens'
import type { Projection, SchemaList } from '../lib/useGameData'
import { useGameData } from '../lib/useGameData'
import { componentsCopy } from '../messages/components'
import { RecoveryPanel } from './index'

/** The failure's panel, centred in the place the gate holds. */
const FAILED = {
  display: 'flex',
  justifyContent: 'center',
  padding: space[24],
} satisfies CSSProperties

/**
 * Gate component — renders children only after game data is preloaded.
 * Use this to wrap island content that depends on ORM calls.
 * On preload failure it renders the crash panel (`RecoveryPanel`, chrome.md
 * K8) with "Try again" instead of the fallback, so a network error never
 * leaves a permanent skeleton.
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
        <RecoveryPanel
          title={componentsCopy('theReferenceDataDidNot')}
          message={componentsCopy('checkYourConnectionThenTry')}
          action={{ label: componentsCopy('tryAgain'), onClick: retry }}
        />
      </div>
    )
  }
  if (!ready) return fallback ?? null
  return children
}
