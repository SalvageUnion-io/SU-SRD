/**
 * PatternList — lists all saved MechPatterns via the patternStore.
 *
 * Each pattern is a user-made Compact (`<Entity size="compact">` (dashed, stamped,
 * credited: ruleset §3.9) linking to its page, its "Build With This" the
 * Compact's last chip (C8), also where its chassis is missing.
 *
 * Data fetching: subscribes to usePatterns — patterns get
 * the same lazy hydration as every other collection.
 *
 * onInstantiated is forwarded from the route so navigation can happen at the
 * route boundary.
 */

import type { CSSProperties } from 'react'
import {
  EmptyState,
  Entity,
  Pending,
  quotePatternName,
  Text,
  tokens,
} from '../../../components/index'
import { UnitRow } from '../../../components/shared/UnitRow'
import { useMe } from '../../../lib/account/accountApi'
import { hereInApp } from '../../../lib/hereInApp'
import {
  asReferencePattern,
  patternChassis,
  savedPatternHref,
} from '../../../lib/patterns/patterns'
import { mechCopy } from '../../../messages/build-mech'
import { usePatterns } from '../../../replica/collections'
import { useSync } from '../../../replica/syncContext'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { SignInControl } from '../../account/SignInControl'
import { InstantiateFromPattern } from './InstantiateFromPattern'

const LIST = {
  '--su-grid-min': '18rem',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSVarStyle

const ROW = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

type PatternListProps = {
  /** Called with the new mech id when a pattern is instantiated. */
  onInstantiated: (mechId: string) => void
  /** The Game each build lands in (the New Mech screen's `?game=`). */
  gameId?: string | undefined
}

export function PatternList({ onInstantiated, gameId }: PatternListProps) {
  // Subscribing keeps the list live — saves from this tab, and those
  // `RoomFeed` adopts from elsewhere, appear without a refetch. list()
  // lazily hydrates.
  const { status } = useSync()
  const me = useMe(status === 'live')
  const madeBy = me?.displayName ?? 'you'
  const patterns = usePatterns((s) => s.mechPatterns)
  const isLoading = !usePatterns((s) => s.hydrated)
  usePatterns.getState().list()

  function handleInstantiated(mechId: string) {
    onInstantiated(mechId)
  }

  if (isLoading) {
    return <Pending label="patterns" />
  }

  if (patterns.length === 0) {
    // Signed out a pattern has nowhere to be kept: say so, and offer the way in.
    if (status === 'signedOut') {
      return (
        <EmptyState
          headline={mechCopy('noPatternsYet')}
          body={mechCopy('signInToKeepPatterns')}
          action={<SignInControl redirectTo={hereInApp()} />}
        />
      )
    }
    return (
      <EmptyState headline={mechCopy('noPatternsYet')} body={mechCopy('useSaveAsPatternFrom')} />
    )
  }

  return (
    <ul className="su-grid" style={LIST} aria-label={mechCopy('savedMechPatterns')}>
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
                    href: savedPatternHref(pattern.id),
                    attrs: { 'aria-label': mechCopy('viewPattern', { name: pattern.name }) },
                  }}
                  lead
                  controls={
                    <InstantiateFromPattern
                      pattern={pattern}
                      onSuccess={handleInstantiated}
                      gameId={gameId}
                    />
                  }
                />
                {/* A header-only row has no footer, so the credit sits beneath it. */}
                <Text variant="hint">{mechCopy('madeBy', { madeBy })}</Text>
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
                    <InstantiateFromPattern
                      pattern={pattern}
                      onSuccess={handleInstantiated}
                      gameId={gameId}
                    />
                  }
                />
                <Text variant="hint">{mechCopy('itsChassisIsNotIn')}</Text>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
