import type { EntityDomain, EntityModel, Fact } from '../types'
import { splitStatLine } from './facts'

/**
 * Where a Mini is drawn, named by its container (`chips-and-actions.md`, C4):
 * the context picks the one fact its lane carries.
 *
 * - `loadout` — what it takes: its Slots (a system, module or bay), a unit's SP,
 *   a cargo lot's Units.
 * - `play` — what it does: its action type, or how many actions it has.
 * - `inventory` — how many are carried, when more than one.
 * - `roster` — a unit's lead vital, as its live reading (`HP | 10/10`).
 * - `browse` — nothing past its rank and cost.
 */
export type ChipContext = 'loadout' | 'play' | 'inventory' | 'roster' | 'browse'

/** One label-first chip (`TL | 2`), or a label alone (`BASE`). */
export type MiniChipCell = { label: string; value?: string }

/** A Mini's context lane, as data: the web draws an action type as its stamps. */
export type MiniLane =
  | { kind: 'cell'; cell: MiniChipCell }
  | { kind: 'actionType'; actionType?: string; mechActionType?: string }

/**
 * A Mini's chips, in the class order (C2): rank, the context lane, then a
 * contentful head's economy (its action type, unless the lane is it), action
 * facets and traits, then the cost.
 */
export type MiniChips = {
  rank?: MiniChipCell
  lane?: MiniLane
  economy?: MiniLane
  facets?: MiniChipCell[]
  traits?: MiniChipCell[]
  cost?: string
}

/** The parts of a model a Mini's chips read. */
export type MiniChipSource = Pick<EntityModel, 'facts'> &
  Partial<
    Pick<
      EntityModel,
      'cost' | 'actionType' | 'mechActionType' | 'folded' | 'actions' | 'kind' | 'tier' | 'traits'
    >
  >

/** What a thing takes in a loadout, first present wins (by the chip's short label): a cargo lot's Units last. */
const TAKES = ['Slots', 'SP', 'HP', 'Units'] as const

/** A unit's lead vital, first present wins. */
const VITALS = ['SP', 'HP'] as const

const RANK_KEY = 'tech-level'

/**
 * A Mini's chips (C3: a static budget): its rank, the one fact its context
 * names, and its read cost. The rank is the Tech Level, or a class's kind
 * where it has none; an ability's tier is its numeral before the name, never
 * a chip. `omit` drops a fact the container already states (C10), by key.
 * A contentful Mini stands for the card it replaces (N3), as a compact Card
 * or Compact head does, so its head adds the economy: the action type (unless the
 * lane already is it), every action facet (`RNG | C`, `DMG | 2`) and the
 * traits. The host adds the state chip (a condition, a count); what a Mini
 * leaves out, its Peek shows.
 */
export function tokenChips(
  model: MiniChipSource,
  context: ChipContext,
  options: { omit?: readonly string[]; count?: number; contentful?: boolean } = {}
): MiniChips {
  const omit = options.omit ?? []
  const kept = model.facts.filter((fact) => !omit.includes(fact.key))
  const byShort = (shorts: readonly string[]): MiniChipCell | undefined => {
    for (const short of shorts) {
      const fact = kept.find((f) => f.short === short)
      if (fact) return { label: fact.short, value: fact.shortValue ?? fact.value }
    }
    return undefined
  }
  const tl = kept.find((fact) => fact.key === RANK_KEY)
  const rank: MiniChipCell | undefined = tl
    ? { label: tl.short, value: tl.shortValue ?? tl.value }
    : !model.tier && model.kind?.classKind
      ? { label: model.kind.classKind }
      : undefined
  const lane = contextLane(model, context, byShort, options.count)
  const economy = options.contentful && context !== 'play' ? economyLane(model) : undefined
  const facets = options.contentful
    ? kept
        .filter((f) => f.group === 'action')
        .map((f) => ({ label: f.short, value: f.shortValue ?? f.value }))
    : []
  const traits = options.contentful
    ? (model.traits ?? []).map((t) => ({ label: t.name, ...(t.param ? { value: t.param } : {}) }))
    : []
  return {
    ...(rank ? { rank } : {}),
    ...(lane ? { lane } : {}),
    ...(economy ? { economy } : {}),
    ...(facets.length ? { facets } : {}),
    ...(traits.length ? { traits } : {}),
    ...(model.cost ? { cost: model.cost } : {}),
  }
}

function contextLane(
  model: MiniChipSource,
  context: ChipContext,
  byShort: (shorts: readonly string[]) => MiniChipCell | undefined,
  count: number | undefined
): MiniLane | undefined {
  const cell = (found: MiniChipCell | undefined): MiniLane | undefined =>
    found ? { kind: 'cell', cell: found } : undefined
  switch (context) {
    case 'loadout':
      return cell(byShort(TAKES))
    case 'roster':
      return cell(byShort(VITALS))
    case 'inventory':
      return count !== undefined && count > 1
        ? { kind: 'cell', cell: { label: '×', value: String(count) } }
        : undefined
    case 'play':
      return economyLane(model)
    case 'browse':
      return undefined
    default: {
      const unknown: never = context
      throw new Error(`tokenChips: unknown context ${String(unknown)}`)
    }
  }
}

/**
 * What it does: its action type, or how many actions it lists. A folded
 * self-action's type is the entity's own, so one listed action beside it is
 * still a count, or its type would read as the entity's.
 */
function economyLane(model: MiniChipSource): MiniLane | undefined {
  const actions = model.actions?.length ?? 0
  if (actions > 1 || (actions === 1 && model.folded)) {
    return { kind: 'cell', cell: { label: 'Actions', value: String(actions) } }
  }
  if (!model.actionType && !model.mechActionType) return undefined
  return {
    kind: 'actionType',
    ...(model.actionType ? { actionType: model.actionType } : {}),
    ...(model.mechActionType ? { mechActionType: model.mechActionType } : {}),
  }
}

/**
 * The one measure a context keeps on a compact Card or Compact head (C3), by short
 * label, from those the head has: what a loadout weighs, a roster's vital.
 * The head keeps it and its Tech Level and drops every other measure.
 */
export function laneMeasure(context: ChipContext, shorts: readonly string[]): string | undefined {
  const pick = context === 'loadout' ? TAKES : context === 'roster' ? VITALS : []
  return pick.find((short) => shorts.includes(short))
}

/**
 * A head's context where its container names none: by what it is. A thing you
 * do reads in play, a thing a unit carries in its loadout, an actor in a
 * roster; anything else browses.
 */
export function naturalContext(kind: {
  domain?: EntityDomain
  nature?: 'have' | 'do'
}): ChipContext {
  if (kind.nature === 'do' || kind.domain === 'action') return 'play'
  if (kind.domain === 'gear' || kind.domain === 'mech' || kind.domain === 'crawler')
    return 'loadout'
  if (kind.domain === 'actor') return 'roster'
  return 'browse'
}

/**
 * A compact Card or Compact head's facts (C3): of its stats, the Tech Level and
 * the one measure its context keeps; then every action facet and datavalue,
 * as a contentful Mini's head keeps them.
 */
export function budgetFacts(facts: readonly Fact[], context: ChipContext): Fact[] {
  const { stats, action } = splitStatLine(facts)
  const lane = laneMeasure(
    context,
    stats.map((fact) => fact.short)
  )
  return [...stats.filter((fact) => fact.key === RANK_KEY || fact.short === lane), ...action]
}
