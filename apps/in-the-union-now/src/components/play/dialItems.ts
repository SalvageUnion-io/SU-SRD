/**
 * dialItems — builds the rotary Dial's item list from the real entity graph.
 *
 * The Dial holds everything that ISN'T the active-row entity: the counterpart
 * entity (pilot when boarded / mech on foot), the linked crawler, plus the
 * always-present statless views (Actions / Tables / SRD). Whatever sits in the
 * active dial slot drives the main display (focus→display sync, Phase 4).
 *
 * Statful items carry compact gauges (derived from the same rules helpers the
 * Active Item uses); statless items are a big centered title — no stats.
 */

import {
  crawlerMaxSP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { MountState } from '../../stores/playStateStore'
import type { GaugeTone } from './CockpitGauge'

export type DialGauge = {
  label: string
  value: number
  max: number
  tone: GaugeTone
  danger?: number
}

export type DialItem =
  | { key: string; statless: true; label: string; sublabel: string }
  | { key: string; statless: false; label: string; tone: GaugeTone; gauges: DialGauge[] }

function pilotItem(pilot: Pilot): DialItem {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  return {
    key: `pilot:${pilot.id}`,
    statless: false,
    label: `Pilot · ${pilot.name}`,
    tone: 'pilot',
    gauges: [
      { label: 'HP', value: Math.min(pilot.currentHP ?? maxHP, maxHP), max: maxHP, tone: 'pilot' },
      { label: 'AP', value: Math.min(pilot.currentAP ?? maxAP, maxAP), max: maxAP, tone: 'pilot' },
    ],
  }
}

function mechItem(mech: Mech): DialItem {
  const chassis = resolveChassisRef(mech.chassisRef)
  const maxSP = mechMaxSP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  return {
    key: `mech:${mech.id}`,
    statless: false,
    label: `Mech · ${mech.name}`,
    tone: 'mech',
    gauges: [
      { label: 'SP', value: Math.min(mech.currentSP ?? maxSP, maxSP), max: maxSP, tone: 'mech' },
      {
        label: 'Heat',
        value: Math.min(mech.currentHeat ?? maxHeat, maxHeat),
        max: maxHeat,
        tone: 'mech',
        danger: Math.max(0, maxHeat - 2),
      },
    ],
  }
}

function crawlerItem(crawler: Crawler): DialItem {
  const maxSP = crawlerMaxSP(crawler)
  return {
    key: `crawler:${crawler.id}`,
    statless: false,
    label: `Crawler · ${crawler.name}`,
    tone: 'crawler',
    gauges: [
      {
        label: 'SP',
        value: Math.min(crawler.currentSP ?? maxSP, maxSP),
        max: maxSP,
        tone: 'crawler',
      },
    ],
  }
}

export function dialItems(args: {
  mount: MountState
  mech: Mech
  pilot: Pilot | null
  crawler: Crawler | null
}): DialItem[] {
  const { mount, mech, pilot, crawler } = args
  const items: DialItem[] = [
    { key: 'actions', statless: true, label: 'Actions', sublabel: 'full action deck' },
  ]
  // The counterpart entity — the one NOT in the active row.
  if (mount !== 'mech') items.push(mechItem(mech))
  if (mount === 'mech' && pilot) items.push(pilotItem(pilot))
  if (crawler) items.push(crawlerItem(crawler))
  items.push({ key: 'tables', statless: true, label: 'Tables', sublabel: 'roll on any table' })
  items.push({ key: 'srd', statless: true, label: 'SRD Explorer', sublabel: 'reference browser' })
  return items
}
