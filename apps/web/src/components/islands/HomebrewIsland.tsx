/**
 * HomebrewIsland — the players' own mech patterns on the SRD (ADR-061).
 *
 * - **On a chassis page** (`chassisRef`): a "Show Homebrew" switch under the
 *   book's patterns. On, it lists the patterns players built on this chassis
 *   and share with everyone on the Reference. The switch is the reader's, held
 *   in this browser, so it stays as set from one chassis to the next. Under it,
 *   a phone's one "Show all N patterns" counts the book's and these; until it
 *   is pressed a phone shows the first two of them all.
 * - **On `/homebrew/`** (no `chassisRef`): every one, newest share first.
 *
 * Each is a Compact with the HOMEBREW hatch, credited "By" its maker, opening
 * its own page in the app (where it can be copied, reported or hidden). The
 * rows come from the Worker (`lib/homebrew/homebrew.ts`); nothing is fetched
 * until the switch is on.
 */

import { useEffect, useState } from 'react'
import type { HomebrewRow } from '../../lib/homebrew/endpoint'
import type { HomebrewItem } from '../../lib/homebrew/homebrew'
import {
  fetchHomebrewPatterns,
  homebrewHref,
  homebrewItems,
  readShowHomebrew,
  writeShowHomebrew,
} from '../../lib/homebrew/homebrew'
import { asReferencePattern } from '../../lib/patterns/patterns'
import { islandsCopy } from '../../messages/components-islands'
import { Toggle } from '../atoms/Toggle'
import { Grid } from '../containers/Grid'
import { loadingCopy } from '../containers/loadingCopy'
import { SlabSection } from '../containers/SlabSection'
import { Entity } from '../entity/Entity'
import { GameDataGate } from '../GameDataGate'
import { Stat, Text } from '../index'
import { ShowAllPatterns } from '../referenceEntity/card/PatternListRow'
import { PATTERNS_ON_A_PHONE } from '../referenceEntity/card/patternsOnAPhone'
import { quotePatternName } from '../referenceEntity/pattern/quotePatternName'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** What a pattern's Compact needs from the reference. */
const SCHEMAS = ['chassis', 'systems', 'modules'] as const

/** The narrowest a row's column gets. */
const COLUMN_MIN = '28rem'

type Load = { state: 'idle' | 'loading' | 'failed' } | { state: 'ready'; rows: HomebrewRow[] }

/** The rows for one chassis or all, read once while `on`. */
function useHomebrew(on: boolean, chassisRef: string | undefined): Load {
  const [load, setLoad] = useState<Load>({ state: 'idle' })
  useEffect(() => {
    if (!on) return
    let live = true
    setLoad({ state: 'loading' })
    fetchHomebrewPatterns(chassisRef).then(
      (rows) => {
        if (live) setLoad({ state: 'ready', rows })
      },
      () => {
        if (live) setLoad({ state: 'failed' })
      }
    )
    return () => {
      live = false
    }
  }, [on, chassisRef])
  return load
}

function HomebrewCompact({ item }: { item: HomebrewItem }) {
  return (
    <Entity
      size="compact"
      entity={item.chassis}
      pattern={asReferencePattern(item.pattern)}
      instance={{ title: quotePatternName(item.pattern.name), userMade: true }}
      mode={{ kind: 'link', href: homebrewHref(item) }}
      labels={
        <Stat key="by" label={islandsCopy('homebrewBy')} value={item.madeBy} size="compact" />
      }
    />
  )
}

function HomebrewList({
  load,
  empty,
  shown = Number.POSITIVE_INFINITY,
}: {
  load: Load
  empty: string
  /** How many a phone shows before "Show all"; the rest wait for it. */
  shown?: number
}) {
  if (load.state !== 'ready') {
    if (load.state === 'idle') return null
    return (
      <Text variant="hint">
        {load.state === 'loading'
          ? loadingCopy(islandsCopy('homebrewNoun'))
          : islandsCopy('homebrewFailed')}
      </Text>
    )
  }
  return (
    <GameDataGate schemas={[...SCHEMAS]} fallback={null}>
      <HomebrewGrid rows={load.rows} empty={empty} shown={shown} />
    </GameDataGate>
  )
}

/** The rows that draw, once the reference data they resolve against is loaded. */
function HomebrewGrid({
  rows,
  empty,
  shown,
}: {
  rows: HomebrewRow[]
  empty: string
  shown: number
}) {
  const items = homebrewItems(rows)
  if (items.length === 0) return <Text variant="hint">{empty}</Text>
  return (
    <Grid min={COLUMN_MIN} gap={12}>
      {items.map((item, i) => (
        <div key={item.appId} className={i < shown ? undefined : 'su-homebrew__more'}>
          <HomebrewCompact item={item} />
        </div>
      ))}
    </Grid>
  )
}

/** A chassis page's switch and, while it is on, that chassis's homebrew. */
function ChassisHomebrew({
  chassisRef,
  bookPatterns,
}: {
  chassisRef: string
  bookPatterns: number
}) {
  const [on, setOn] = useState(false)
  // After mount: the server's render has no storage to read.
  useEffect(() => setOn(readShowHomebrew()), [])
  const load = useHomebrew(on, chassisRef)
  // Counted as served: resolving them waits on the reference data (the gate below).
  const homebrew = on && load.state === 'ready' ? load.rows.length : 0
  return (
    <>
      <SlabSection
        id="homebrew-patterns"
        title={islandsCopy('homebrewPatterns')}
        page
        actions={
          <Toggle
            pressed={on}
            onClick={() => {
              writeShowHomebrew(!on)
              setOn(!on)
            }}
          >
            {islandsCopy('showHomebrew')}
          </Toggle>
        }
      >
        {on ? (
          <HomebrewList
            load={load}
            empty={islandsCopy('homebrewNoneOnChassis')}
            shown={Math.max(0, PATTERNS_ON_A_PHONE - bookPatterns)}
          />
        ) : (
          <Text variant="hint">{islandsCopy('homebrewOff')}</Text>
        )}
      </SlabSection>
      <ShowAllPatterns
        count={bookPatterns + homebrew}
        target={bookPatterns > 0 ? 'patterns' : 'homebrew-patterns'}
      />
    </>
  )
}

export function HomebrewIsland({
  chassisRef,
  bookPatterns = 0,
}: {
  chassisRef?: string
  /** How many patterns the book prints for the chassis, listed above. */
  bookPatterns?: number
}) {
  const all = useHomebrew(chassisRef === undefined, undefined)
  return (
    <IslandErrorBoundary>
      {chassisRef === undefined ? (
        <HomebrewList load={all} empty={islandsCopy('homebrewNone')} />
      ) : (
        <ChassisHomebrew chassisRef={chassisRef} bookPatterns={bookPatterns} />
      )}
    </IslandErrorBoundary>
  )
}
