/**
 * DisplayView — the cockpit's main display: the ONE surface that reads
 * "forward". It renders the faithful light SRD reference document for whatever
 * the Dial is focused on (focus→display sync), reusing suref-react's
 * ReferenceEntityDisplay / ReferenceEntityActions / RollTable verbatim — the
 * same components the live sheet and reference site show (proposed ADR-017).
 *
 * Phase 4 scope: render real reference content per focus (entity card + its
 * actions, or a roll table, or the SRD/Actions landing). Read-only — activating
 * actions, rolling into state, and the resolve flow are Phase 5.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, RollTable } from 'suref-react'

import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { DialItem } from './dialItems'

const HIDE_CHOICES = { choices: true } as const

type DisplayViewProps = {
  focus: DialItem | undefined
  mech: Mech
  pilot: Pilot | null
  crawler: Crawler | null
}

/** A framed reference card, or a graceful fallback when a slug doesn't resolve. */
function EntityCard({ data, note }: { data: SURefEntity | null; note: string }) {
  if (!data) return <div className="pc-display-note">{note}</div>
  return <ReferenceEntityDisplay data={data} hide={HIDE_CHOICES} />
}

export function DisplayView({ focus, mech, pilot, crawler }: DisplayViewProps) {
  if (!focus) return <div className="pc-display-note">Nothing selected.</div>

  if (focus.statless) {
    if (focus.key === 'tables') {
      const table = SalvageUnionReference.RollTables.find((t) => t.name === 'Core Mechanic') as
        | Parameters<typeof RollTable>[0]['table']
        | undefined
      return (
        <div className="pc-display-scroll">
          {table ? (
            <RollTable table={table} tableName="Core Mechanic" />
          ) : (
            <div className="pc-display-note">Roll tables load here.</div>
          )}
        </div>
      )
    }
    // Actions deck (Phase 5) and the SRD explorer (later) land here.
    const label = focus.key === 'actions' ? 'Actions deck' : 'SRD explorer'
    return (
      <div className="pc-display-note">
        {label} — {focus.sublabel}. (Interactive content lands in a later phase.)
      </div>
    )
  }

  // Statful entity focus → its reference card.
  if (focus.key.startsWith('mech:')) {
    const chassis = resolveChassisRef(mech.chassisRef) as SURefEntity | null
    return (
      <div className="pc-display-scroll">
        <EntityCard
          data={chassis}
          note={`Chassis “${mech.chassisRef}” not in the reference set.`}
        />
      </div>
    )
  }
  if (focus.key.startsWith('pilot:') && pilot) {
    const cls = (SalvageUnionReference.Classes.find((c) => c.id === pilot.classRef) ??
      null) as SURefEntity | null
    return (
      <div className="pc-display-scroll">
        <EntityCard data={cls} note={`Class “${pilot.classRef}” not in the reference set.`} />
      </div>
    )
  }
  if (focus.key.startsWith('crawler:') && crawler) {
    return (
      <div className="pc-display-note">
        Crawler · {crawler.name} — bay reference lands in a later phase.
      </div>
    )
  }

  return <div className="pc-display-note">{focus.label}</div>
}
