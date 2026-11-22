/**
 * HomebrewIsland — the players' own mech patterns on the SRD (ADR-061).
 *
 * - **On a chassis page** (`chassisRef`): a "Show Homebrew" switch under the
 *   book's patterns, reading "Hide Homebrew" while on, and gone once the
 *   chassis is known to have none. On, it lists the patterns players built on this chassis
 *   and share with everyone on the Reference. The switch is the reader's, held
 *   in this browser, so it stays as set from one chassis to the next.
 * - **On `/homebrew/`** (no `chassisRef`): every one, newest share first.
 *
 * They are listed as a chassis page lists the book's patterns: one Ledger
 * (ledger.md L1), a line a pattern, its name opening its own page in the app
 * (where it can be copied, reported or hidden), then its chassis, its maker
 * and its loadout. Homebrew reads as ruleset §3.9 has it: a solid frame, the
 * dashed HOMEBREW stamp beside the title tab, the makers credited, the foot
 * saying whose it is.
 * The players' rows come from the Worker (`lib/homebrew/homebrew.ts`); nothing
 * is fetched until the switch is on.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { HomebrewRow } from '../../lib/homebrew/endpoint'
import {
  fetchHomebrewPatterns,
  homebrewItems,
  playerHomebrewEntry,
  readShowHomebrew,
  writeShowHomebrew,
} from '../../lib/homebrew/homebrew'
import { getSchemaPreloadList } from '../../lib/schemaPreloadDeps'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { CiteLine } from '../atoms/CiteLine'
import { Toggle } from '../atoms/Toggle'
import { loadingCopy } from '../containers/loadingCopy'
import { SlabSection } from '../containers/SlabSection'
import { paintFor } from '../entity'
import { useEntitySurface } from '../entity/entitySurfaceContext'
import type { LedgerColumn } from '../entity/Ledger'
import { Ledger } from '../entity/Ledger'
import { GameDataGate } from '../GameDataGate'
import { Text } from '../index'
import { ReferenceSurface } from '../ReferenceSurface'
import { HomebrewStamp } from '../referenceEntity/card/HomebrewStamp'
import { quotePatternName } from '../referenceEntity/pattern/quotePatternName'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** What a pattern's listing needs from the reference: a chassis page's own bundle (its parts' actions and traits too). */
const SCHEMAS = getSchemaPreloadList('chassis')

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

function HomebrewList({ load, empty }: { load: Load; empty: ReactNode }) {
  if (load.state === 'idle') return null
  return (
    <>
      <GameDataGate schemas={SCHEMAS} fallback={null}>
        {/* The SRD's surface: the Ledger's band takes the page's texture. */}
        <ReferenceSurface>
          <HomebrewLedger
            rows={load.state === 'ready' ? load.rows : []}
            empty={load.state === 'ready' ? empty : null}
          />
        </ReferenceSurface>
      </GameDataGate>
      {load.state !== 'ready' && (
        <Text variant="hint">
          {load.state === 'loading'
            ? loadingCopy(islandsCopy('homebrewNoun'))
            : islandsCopy('homebrewFailed')}
        </Text>
      )}
    </>
  )
}

const HOMEBREW_COLUMNS: readonly LedgerColumn[] = [
  { key: 'chassis', label: islandsCopy('chassis'), kind: 'text', phone: true },
  { key: 'by', label: islandsCopy('madeBy'), kind: 'text' },
  { key: 'loadout', label: islandsCopy('loadout'), kind: 'line' },
]

/** A loadout's names as running text. */
const names = (list: readonly { name: string }[] | undefined) =>
  (list ?? []).map((entry) => entry.name)

/** The rows that draw, once the reference data they resolve against is loaded. */
function HomebrewLedger({
  rows,
  empty,
}: {
  rows: HomebrewRow[]
  /** Said when there are none; null while the players' are still coming. */
  empty: ReactNode | null
}) {
  const entries = homebrewItems(rows).map(playerHomebrewEntry)
  const surface = useEntitySurface()
  const first = entries[0]
  if (!first) return empty === null ? null : <Text variant="hint">{empty}</Text>
  return (
    <Ledger
      label={islandsCopy('homebrewPatterns')}
      // The band is the chassis's (a mech's tone), as the book's patterns' is.
      paint={paintFor(toEntityModel(first.chassis as RefMetaEntity).tone, {
        texture: surface.texture,
      })}
      nameLabel={islandsCopy('patterns')}
      count={entries.length}
      mark={<HomebrewStamp size="mini" />}
      columns={HOMEBREW_COLUMNS}
      rows={entries.map((entry) => ({
        id: entry.key,
        name: quotePatternName(entry.pattern.name),
        entityRef: undefined,
        href: entry.href,
        cells: [
          entry.chassis.name,
          entry.madeBy,
          [...names(entry.pattern.systems), ...names(entry.pattern.modules)].join(', '),
        ],
      }))}
      foot={<CiteLine text={islandsCopy('homebrewCite')} />}
    />
  )
}

/** A chassis page's switch and, while it is on, that chassis's homebrew. */
function ChassisHomebrew({ chassisRef }: { chassisRef: string }) {
  const [on, setOn] = useState(false)
  // After mount: the server's render has no storage to read.
  useEffect(() => setOn(readShowHomebrew()), [])
  const load = useHomebrew(on, chassisRef)
  // Known to hold none, the switch has nothing to show or hide: it steps
  // aside and the note stands alone (RR2-17). Before a first press nothing
  // has been asked for, so it cannot be known.
  const none = on && load.state === 'ready' && load.rows.length === 0
  return (
    <SlabSection
      id="homebrew-patterns"
      title={islandsCopy('homebrewPatterns')}
      page
      className="su-homebrew"
      actions={
        none ? undefined : (
          <Toggle
            pressed={on}
            onClick={() => {
              writeShowHomebrew(!on)
              setOn(!on)
            }}
          >
            {on ? islandsCopy('hideHomebrew') : islandsCopy('showHomebrew')}
          </Toggle>
        )
      }
    >
      {on ? (
        <HomebrewList
          load={load}
          // None here is not the end of it: the note is the way to the rest (RR2-17).
          empty={
            <>
              {islandsCopy('homebrewNoneOnChassis')}{' '}
              <a href="/homebrew/" className="su-inline-ref su-inline-ref--link su-focus-ring">
                {islandsCopy('homebrewEvery')}
              </a>
            </>
          }
        />
      ) : (
        <Text variant="hint">{islandsCopy('homebrewOff')}</Text>
      )}
    </SlabSection>
  )
}

export function HomebrewIsland({ chassisRef }: { chassisRef?: string }) {
  const all = useHomebrew(chassisRef === undefined, undefined)
  return (
    <IslandErrorBoundary>
      {chassisRef === undefined ? (
        <HomebrewList load={all} empty={islandsCopy('homebrewNone')} />
      ) : (
        <ChassisHomebrew chassisRef={chassisRef} />
      )}
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it: `HomebrewIsland` swapped in over its stand-in (`clientSwap`). */
export const HomebrewIslandClient = clientSwap('HomebrewIsland', HomebrewIsland)
