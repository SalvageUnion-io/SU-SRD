/**
 * DisplayPanel (ITUN binding) — resolves the Dial focus into what the Dashboard's
 * main display shows, then hands a pure `content` to the presentational
 * DisplayPanel in component-lib. Statless focuses map to the Tables view, the SRD
 * Explorer, or the store/rules-wired Actions deck (passed as a slot); statful
 * focuses resolve the entity's reference data + build the entity-level controls
 * (Load Into Mech / Enter Downtime / Full sheet →) off the play-state store.
 */

import { DisplayPanel as DisplayPanelView } from 'component-lib'
import type { DisplayContent, ReferenceEntityControl } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

import { resolveCrawlerType } from '../../lib/crawlerRefs'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { usePlayStateStore } from '../../stores/playStateStore'
import { ActionsDeck } from './ActionsDeck'
import type { DialItem } from './dialItems'

type DisplayPanelProps = {
  focus: DialItem | undefined
  mech: Mech
  pilot: Pilot | null
  crawler: Crawler | null
}

export function DisplayPanel({ focus, mech, pilot, crawler }: DisplayPanelProps) {
  const enterDowntime = usePlayStateStore((s) => s.enterDowntime)
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)

  const content = ((): DisplayContent => {
    if (!focus) return { kind: 'note', text: 'Nothing selected.' }

    if (focus.statless) {
      if (focus.key === 'tables') return { kind: 'tables' }
      if (focus.key === 'actions') {
        return { kind: 'slot', node: <ActionsDeck mech={mech} pilot={pilot} mount={mount} /> }
      }
      if (focus.key === 'srd') return { kind: 'srd' }
      return { kind: 'note', text: focus.label }
    }

    // Statful entity focus → its reference card + entity-level foot actions.
    if (focus.key.startsWith('mech:')) {
      const chassis = resolveChassisRef(mech.chassisRef) as SURefEntity | null
      const controls: ReferenceEntityControl[] = []
      if (mount === 'pilot') {
        controls.push({
          key: 'load',
          label: 'Load Into Mech ▶',
          ariaLabel: 'Load Into Mech',
          onClick: () => setMount('mech'),
          variant: 'primary',
        })
      }
      controls.push({ key: 'sheet', href: `/sheet/mech/${mech.id}`, label: 'Full mech sheet →' })
      return {
        kind: 'entity',
        data: chassis,
        note: `Chassis “${mech.chassisRef}” not in the reference set.`,
        controls,
      }
    }
    if (focus.key.startsWith('pilot:') && pilot) {
      const cls = (SalvageUnionReference.Classes.find((c) => c.id === pilot.classRef) ??
        null) as SURefEntity | null
      return {
        kind: 'entity',
        data: cls,
        note: `Class “${pilot.classRef}” not in the reference set.`,
        controls: [{ key: 'sheet', href: `/sheet/pilot/${pilot.id}`, label: 'Full pilot sheet →' }],
      }
    }
    if (focus.key.startsWith('crawler:') && crawler) {
      const crawlerRef = crawler.type
        ? (resolveCrawlerType(crawler.type) as unknown as SURefEntity | null)
        : null
      return {
        kind: 'entity',
        data: crawlerRef,
        note: `Crawler · ${crawler.name} — back at the Union Crawler for the Downtime loop.`,
        controls: [
          {
            key: 'downtime',
            label: 'Enter Downtime ▶',
            ariaLabel: 'Enter Downtime',
            onClick: enterDowntime,
            variant: 'primary',
          },
          { key: 'sheet', href: `/sheet/crawler/${crawler.id}`, label: 'Full crawler sheet →' },
        ],
      }
    }

    return { kind: 'note', text: focus.label }
  })()

  return <DisplayPanelView content={content} />
}
