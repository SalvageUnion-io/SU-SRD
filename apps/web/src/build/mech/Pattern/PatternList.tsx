/**
 * PatternList — lists all saved MechPatterns via the patternStore.
 *
 * Each pattern is a user-made Compact (`<Entity size="compact">` (dashed, stamped,
 * credited: ruleset §3.9) linking to its page, its "Build With This" the
 * Compact's last chip (C8, hard rule R6), also where its chassis is missing.
 *
 * Data fetching: subscribes to usePatternStore — patterns get
 * the same lazy hydration as every other collection.
 *
 * onInstantiated is forwarded from the route so navigation can happen at the
 * route boundary.
 */

import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../../convex/_generated/api'
import {
  EmptyState,
  Entity,
  Pending,
  quotePatternName,
  Text,
  tokens,
} from '../../../components/index'
import { UnitRow } from '../../../components/shared/UnitRow'
import { useConnection } from '../../../lib/connection/connectionContext'
import { asReferencePattern, patternChassis, patternHref } from '../../../lib/patterns/patterns'
import { usePatternStore } from '../../../stores/patternStore'
import { InstantiateFromPattern } from './InstantiateFromPattern'

const LIST = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

type PatternListProps = {
  /** Called with the new mech id when a pattern is instantiated. */
  onInstantiated: (mechId: string) => void
}

export function PatternList({ onInstantiated }: PatternListProps) {
  // Subscribing keeps the list live — saves from this tab, and those
  // `ShelfSync` adopts from elsewhere, appear without a refetch. list()
  // lazily hydrates.
  const { mode } = useConnection()
  const me = useQuery(api.account.me, mode === 'connected' ? {} : 'skip')
  const madeBy = me?.displayName ?? 'you'
  const patterns = usePatternStore((s) => s.mechPatterns)
  const isLoading = !usePatternStore((s) => s.hydrated)
  usePatternStore.getState().list()

  function handleInstantiated(mechId: string) {
    onInstantiated(mechId)
  }

  if (isLoading) {
    return <Pending label="patterns" />
  }

  if (patterns.length === 0) {
    return (
      <EmptyState
        headline="No Patterns yet"
        body="Use “Save as pattern” from a mech sheet’s More actions menu, or the mech builder, to save a reusable template."
      />
    )
  }

  return (
    <ul style={LIST} aria-label="Saved mech patterns">
      {patterns.map((pattern) => {
        const chassis = patternChassis(pattern)
        return (
          <li key={pattern.id} style={ROW} data-testid="pattern-list-item">
            {chassis ? (
              <>
                {/* The row is its page: where the maker sees it as others
                    will, and shares it. Build With This is its last chip. */}
                <Entity
                  size="compact"
                  entity={chassis}
                  pattern={asReferencePattern(pattern)}
                  instance={{ title: quotePatternName(pattern.name), userMade: true }}
                  mode={{
                    kind: 'link',
                    href: patternHref(pattern.id),
                    attrs: { 'aria-label': `View pattern ${pattern.name}` },
                  }}
                  lead
                  controls={
                    <InstantiateFromPattern pattern={pattern} onSuccess={handleInstantiated} />
                  }
                />
                {/* A header-only row has no footer, so the credit sits beneath it. */}
                <Text variant="hint">Made by {madeBy}</Text>
              </>
            ) : (
              <>
                {/* No chassis to draw: a plain user-made unit Compact, its Build
                    With This still the Compact's last chip. */}
                <UnitRow
                  kind="mech"
                  name={pattern.name}
                  userMade
                  controls={
                    <InstantiateFromPattern pattern={pattern} onSuccess={handleInstantiated} />
                  }
                />
                <Text variant="hint">Its chassis is not in the reference.</Text>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
