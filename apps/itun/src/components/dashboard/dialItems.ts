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

import type { DialItem as DialCellItem } from 'component-lib'
import { linesFromBreakdown } from 'component-lib'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import {
  crawlerMaxSPParts,
  mechMaxHeatParts,
  mechMaxSPParts,
  pilotMaxAPParts,
  pilotMaxHPParts,
} from '../../lib/rules/derivedStats'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import type { CockpitPrefs, DialKind } from '../../lib/schemas/cockpitPrefs'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { MountState } from '../../stores/playStateStore'

export type DialItem = DialCellItem & { kind: DialKind }

/** Human-facing label for each dial kind — used by the dial-config overlay. */
export const DIAL_KIND_LABELS: Record<DialKind, string> = {
  actions: 'Actions',
  mech: 'Mech',
  pilot: 'Pilot',
  crawler: 'Crawler',
  tables: 'Tables',
  srd: 'SRD Explorer',
}

/** The kind that can never be hidden (locked visible in the config overlay). */
export const LOCKED_DIAL_KIND: DialKind = 'actions'

function pilotItem(pilot: Pilot): DialItem {
  const hpParts = pilotMaxHPParts(pilot)
  const apParts = pilotMaxAPParts(pilot)
  const maxHP = Math.max(0, hpParts.total)
  const maxAP = Math.max(0, apParts.total)
  return {
    key: `pilot:${pilot.id}`,
    kind: 'pilot',
    statless: false,
    label: `Pilot · ${pilot.name}`,
    tone: 'pilot',
    gauges: [
      {
        label: 'HP',
        value: Math.min(pilot.currentHP ?? maxHP, maxHP),
        max: maxHP,
        tone: 'pilot',
        provenance: linesFromBreakdown(hpParts, {
          base: 'Pilot',
          baseDetail: 'base',
          installed: 'Injuries',
          installedDetail: 'rules A11',
        }),
        ...(hpParts.overridden ? { derivedMax: hpParts.derived } : {}),
      },
      {
        label: 'AP',
        value: Math.min(pilot.currentAP ?? maxAP, maxAP),
        max: maxAP,
        tone: 'pilot',
        provenance: linesFromBreakdown(apParts, { base: 'Pilot', baseDetail: 'base' }),
        ...(apParts.overridden ? { derivedMax: apParts.derived } : {}),
      },
    ],
  }
}

/**
 * Beefcake is a PILOT ability that raises the piloted MECH's Max SP and Cargo
 * (ADR-029), so the mech dial cannot be derived from the mech alone.
 */
function mechItem(mech: Mech, pilot: Pilot | null): DialItem {
  const chassis = resolveChassisRef(mech.chassisRef)
  const piloting = pilotingContext(mech, pilot?.abilities)
  const spParts = mechMaxSPParts(mech, chassis, piloting)
  const heatParts = mechMaxHeatParts(mech, chassis, piloting)
  const maxSP = spParts.total
  const maxHeat = heatParts.total
  const chassisLabel = `${chassis?.name ?? mech.chassisRef} chassis`
  return {
    key: `mech:${mech.id}`,
    kind: 'mech',
    statless: false,
    label: `Mech · ${mech.name}`,
    tone: 'mech',
    gauges: [
      {
        label: 'SP',
        value: Math.min(mech.currentSP ?? maxSP, maxSP),
        max: maxSP,
        tone: 'mech',
        provenance: linesFromBreakdown(spParts, {
          base: chassisLabel,
          baseDetail: 'base',
          installed: 'Installed systems & modules',
        }),
        ...(spParts.overridden ? { derivedMax: spParts.derived } : {}),
      },
      {
        label: 'Heat',
        value: Math.min(mech.currentHeat ?? 0, maxHeat),
        max: maxHeat,
        tone: 'mech',
        danger: Math.max(0, maxHeat - 2),
        provenance: linesFromBreakdown(heatParts, {
          base: chassisLabel,
          baseDetail: 'base',
          installed: 'Installed systems & modules',
        }),
        ...(heatParts.overridden ? { derivedMax: heatParts.derived } : {}),
      },
    ],
  }
}

function crawlerItem(crawler: Crawler): DialItem {
  const spParts = crawlerMaxSPParts(crawler)
  const maxSP = spParts.total
  return {
    key: `crawler:${crawler.id}`,
    kind: 'crawler',
    statless: false,
    label: `Crawler · ${crawler.name}`,
    tone: 'crawler',
    gauges: [
      {
        label: 'SP',
        value: Math.min(crawler.currentSP ?? maxSP, maxSP),
        max: maxSP,
        tone: 'crawler',
        provenance: linesFromBreakdown(spParts, {
          base: `Tech ${crawler.techLevel?.replace(/\D/g, '') || '?'} Crawler`,
          baseDetail: 'base',
          installed: 'Crawler type bonus',
        }),
        ...(spParts.overridden ? { derivedMax: spParts.derived } : {}),
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
    {
      key: 'actions',
      kind: 'actions',
      statless: true,
      label: 'Actions',
      sublabel: 'full action deck',
    },
  ]
  // The counterpart entities — everything NOT in the active row. In Downtime
  // the crawler is active, so the dial carries the mech + pilot instead.
  if (mount !== 'mech') items.push(mechItem(mech, pilot))
  if (mount !== 'pilot' && pilot) items.push(pilotItem(pilot))
  if (mount !== 'downtime' && crawler) items.push(crawlerItem(crawler))
  items.push({
    key: 'tables',
    kind: 'tables',
    statless: true,
    label: 'Tables',
    sublabel: 'roll on any table',
  })
  items.push({
    key: 'srd',
    kind: 'srd',
    statless: true,
    label: 'SRD Explorer',
    sublabel: 'reference browser',
  })
  return items
}

/**
 * The dial kinds a Dashboard CAN show given the linked entities, in default order
 * — the config overlay's universe (independent of the current mount, which
 * only decides which of these ride the dial vs. sit in the active row).
 */
export function configurableKinds(args: {
  pilot: Pilot | null
  crawler: Crawler | null
}): DialKind[] {
  const kinds: DialKind[] = ['actions', 'mech']
  if (args.pilot) kinds.push('pilot')
  if (args.crawler) kinds.push('crawler')
  kinds.push('tables', 'srd')
  return kinds
}

/**
 * Order a list of dial kinds by a prefs order (unlisted kinds keep their
 * default relative position, after the ordered ones). Shared by the dial-config
 * overlay's row layout and mirrored by applyDialPrefs's item ordering.
 */
export function orderKinds(kinds: DialKind[], prefs?: CockpitPrefs): DialKind[] {
  if (!prefs || prefs.order.length === 0) return kinds
  const rank = (k: DialKind): number => {
    const i = prefs.order.indexOf(k)
    return i === -1 ? prefs.order.length : i
  }
  return kinds
    .map((k, i) => ({ k, i }))
    .sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i)
    .map((x) => x.k)
}

/**
 * Apply persisted dial prefs to a freshly-built item list: drop hidden kinds
 * (never `actions`), then reorder by the stored kind order (unlisted kinds keep
 * their default relative order, after the ordered ones). Pure — the Dial reads
 * the result; Dashboard owns fetching prefs for the container.
 */
export function applyDialPrefs(items: DialItem[], prefs?: CockpitPrefs): DialItem[] {
  if (!prefs) return items
  const hidden = new Set<DialKind>(prefs.hidden.filter((k) => k !== LOCKED_DIAL_KIND))
  const visible = items.filter((it) => !hidden.has(it.kind))
  if (prefs.order.length === 0) return visible
  const rank = (k: DialKind): number => {
    const i = prefs.order.indexOf(k)
    return i === -1 ? prefs.order.length : i
  }
  // Decorate-sort-undecorate keeps the sort stable across engines: equal ranks
  // (e.g. two unlisted kinds) preserve their original relative order.
  return visible
    .map((it, i) => ({ it, i }))
    .sort((a, b) => rank(a.it.kind) - rank(b.it.kind) || a.i - b.i)
    .map((x) => x.it)
}
