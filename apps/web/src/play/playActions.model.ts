/**
 * The Actions column's one flattened list (play.md §5): every action the
 * pilot and the mech carry, the Reactor and Mount controls, and the Downtime
 * actions, each with what it needs to be on hand in this Situation. Pure: the
 * column (`usePlayActions`) builds it and draws it.
 *
 *  - **On foot:** the pilot's own actions are on hand; the mech's need Boarded.
 *  - **Boarded:** the mech's actions and the pilot's own, as the deck has
 *    always kept them (the pilot is in the cockpit), the Reactor too.
 *  - **Downtime:** the Downtime actions (an action typed Downtime, training,
 *    trading and crafting, Cantina Rumours); everything else waits for after
 *    Downtime, in the collapsed Field actions.
 *
 * Nothing is unreachable: an action not on hand is still listed, with why.
 */

import type { RangeBand } from 'cantina-domain/schemas/seat'
import type { RefMetaAction } from 'salvageunion-reference'
import type { PlayAction } from '../lib/rules/playActions'
import { actionInRange, actionReachable } from '../lib/rules/playActions'
import type { Situation } from './situation.model'

/** An action's type, as the list sorts and filters it. */
export type ActionTypeKey =
  | 'Turn'
  | 'Short'
  | 'Long'
  | 'Reaction'
  | 'Free'
  | 'Downtime'
  | 'Passive'
  | 'Other'

/** The list's order: Turn, Short, Long, Reaction, Free, Downtime, then the rest. */
const ACTION_TYPE_ORDER: readonly ActionTypeKey[] = [
  'Turn',
  'Short',
  'Long',
  'Reaction',
  'Free',
  'Downtime',
  'Passive',
  'Other',
]

/** The type filter above the list. */
export const TYPE_FILTERS = ['All', 'Turn', 'Short', 'Long', 'Reaction', 'Free'] as const
export type TypeFilter = (typeof TYPE_FILTERS)[number]

/** The action's type, from the book's `actionType` ("DownTime" is Downtime). */
export function actionTypeOf(action: RefMetaAction): ActionTypeKey {
  const type = action.actionType
  if (type === 'DownTime') return 'Downtime'
  return ACTION_TYPE_ORDER.find((t) => t === type) ?? 'Other'
}

/** What an action not on hand is waiting for. */
export type Need = 'boarded' | 'downtime' | 'afterDowntime'

/** Why an action is not on hand, as its row says it. */
export const NEED_TEXT: Record<Need, string> = {
  boarded: 'needs Boarded',
  downtime: 'needs Downtime',
  afterDowntime: 'after Downtime',
}

/** The Downtime actions the guide names that are not an action of a unit. */
export type DowntimeActionId = 'train' | 'craftTrade' | 'rumours'

const DOWNTIME_ACTIONS: readonly { id: DowntimeActionId; name: string }[] = [
  { id: 'train', name: 'Train your Pilot' },
  { id: 'craftTrade', name: 'Craft · Trade' },
  { id: 'rumours', name: 'Gather Cantina Rumours' },
]

/** One line of the list. */
export type ListEntry =
  | {
      kind: 'action'
      key: string
      name: string
      type: ActionTypeKey
      source: 'pilot' | 'mech'
      action: PlayAction
      need: Need | null
    }
  | { kind: 'reactor'; key: 'reactor'; name: 'Reactor'; need: Need | null }
  | { kind: 'mount'; key: 'mount'; name: 'Mount'; need: Need | null }
  | {
      kind: 'downtime'
      key: `downtime:${DowntimeActionId}`
      id: DowntimeActionId
      name: string
      need: Need | null
    }

/** What a unit's action needs in this Situation; null when it is on hand. */
export function needFor(
  source: 'pilot' | 'mech',
  type: ActionTypeKey,
  situation: Situation
): Need | null {
  if (situation === 'downtime') return type === 'Downtime' ? null : 'afterDowntime'
  if (type === 'Downtime') return 'downtime'
  if (source === 'mech' && situation !== 'boarded') return 'boarded'
  return null
}

export type ActionListInput = {
  situation: Situation
  /** The pilot's actions (`buildPilotActions`). */
  pilotActions: readonly PlayAction[]
  /** The mech's (`buildMechActions`): the boarded one's, or the one Board would board. */
  mechActions: readonly PlayAction[]
  /** Whether there is a mech whose Reactor the list offers. */
  hasMech: boolean
}

/** Where a type sorts in the list (Turn first); the Mediator's NPC actions sort the same. */
export function typeRank(type: ActionTypeKey): number {
  return ACTION_TYPE_ORDER.indexOf(type)
}

/**
 * The whole list, in order: the units' actions by type (the mech's before the
 * pilot's within a type, each in its book order), then the Reactor and Mount,
 * then the Downtime actions.
 */
export function buildActionList({
  situation,
  pilotActions,
  mechActions,
  hasMech,
}: ActionListInput): ListEntry[] {
  const units: ListEntry[] = [
    ...mechActions.map((action) => unitEntry(action, 'mech', situation)),
    ...pilotActions.map((action) => unitEntry(action, 'pilot', situation)),
  ]
  const sorted = units
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => rankOf(a.entry) - rankOf(b.entry) || a.i - b.i)
    .map(({ entry }) => entry)
  const field: Need | null = situation === 'downtime' ? 'afterDowntime' : null
  const reactorNeed: Need | null = field ?? (situation === 'boarded' ? null : 'boarded')
  const controls: ListEntry[] = []
  if (hasMech)
    controls.push({ kind: 'reactor', key: 'reactor', name: 'Reactor', need: reactorNeed })
  controls.push({ kind: 'mount', key: 'mount', name: 'Mount', need: field })
  const downtime: ListEntry[] = DOWNTIME_ACTIONS.map(({ id, name }) => ({
    kind: 'downtime',
    key: `downtime:${id}`,
    id,
    name,
    need: situation === 'downtime' ? null : 'downtime',
  }))
  return [...sorted, ...controls, ...downtime]
}

function unitEntry(action: PlayAction, source: 'pilot' | 'mech', situation: Situation): ListEntry {
  const type = actionTypeOf(action.action)
  return {
    kind: 'action',
    key: action.key,
    name: action.name,
    type,
    source,
    action,
    need: needFor(source, type, situation),
  }
}

function rankOf(entry: ListEntry): number {
  return entry.kind === 'action' ? typeRank(entry.type) : ACTION_TYPE_ORDER.length
}

/** Words a control row answers to in Find, besides its name. */
const CONTROL_WORDS: Record<'reactor' | 'mount', string> = {
  reactor: 'Push Heat Check Vent Shutdown Shut down',
  mount: 'Board Dismount Eject',
}

/**
 * The entries the type filter and Find leave. A typed action must match the
 * filter; the Reactor, Mount and Downtime rows are controls, kept under every
 * filter. Find matches the name, the action's source and a control's verbs.
 */
export function filterEntries(
  entries: readonly ListEntry[],
  filter: TypeFilter,
  find: string
): ListEntry[] {
  const query = find.trim().toLowerCase()
  return entries.filter((entry) => {
    if (filter !== 'All' && entry.kind === 'action' && entry.type !== filter) return false
    if (query === '') return true
    const words =
      entry.kind === 'action'
        ? `${entry.name} ${entry.action.ownerName}`
        : entry.kind === 'downtime'
          ? entry.name
          : `${entry.name} ${CONTROL_WORDS[entry.kind]}`
    return words.toLowerCase().includes(query)
  })
}

/** On hand first, then what is not, each keeping the list's order. */
export function splitOnHand(entries: readonly ListEntry[]): {
  onHand: ListEntry[]
  away: ListEntry[]
} {
  return {
    onHand: entries.filter((e) => e.need === null),
    away: entries.filter((e) => e.need !== null),
  }
}

/**
 * Why an on-hand action cannot run as it stands, or null: its item is
 * Destroyed, the engagement range is outside its own, or its Hot would pass
 * the Heat Capacity. It stays usable: the resolve says the same.
 */
export function lockReason(
  action: PlayAction,
  range: RangeBand,
  heat: { current: number; cap: number }
): string | null {
  if (action.condition === 'destroyed') return 'Destroyed'
  if (!actionInRange(action.action, range)) return `Out of Range at ${range}`
  if (!actionReachable(action, range, heat.current, heat.cap)) return 'Over the Heat Capacity'
  return null
}
