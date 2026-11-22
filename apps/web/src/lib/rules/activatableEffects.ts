/**
 * Activated contributions a mech/pilot can switch on (F1, ADR-029).
 *
 * `duration: 'activated'` contributions apply only while the player has them
 * on. **Manual expiry by design**: Salvage Union states real durations ("this
 * effect lasts for 1 hour"), but the app has no play clock, and inventing one
 * would put wall-time into the data layer and make a sheet's numbers change
 * while nobody is looking. The table keeps time; the app keeps state — the same
 * division ADR-001's honour system already relies on.
 *
 * Pure: this only enumerates what COULD be switched on. Whether it is on lives
 * on the pilot's seat in the Game (ADR-038), never on the entity.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { StatLabel } from 'salvageunion-reference'
import { SalvageUnionReference, STAT_LABELS } from 'salvageunion-reference'
import { resolveInstalledRef } from 'salvageunion-reference/rules'
import { libRulesCopy } from '../../messages/lib-rules'

export type ActivatableEffect = {
  /** The declaring record's ref — the key play state toggles on. */
  ref: string
  /** Display name. */
  name: string
  /** One line describing what switching it on does. */
  summary: string
  /** The rule's first sentence, as the record prints it; null when it has none (r6 A11). */
  rule: string | null
  /** Its activation cost ("1 AP", "2 EP"); null when it costs nothing fixed. */
  cost: string | null
  /** Where the full text is: the ability or the installed item, for a Peek. */
  source: 'ability' | 'item'
}

type WithContributions = {
  name?: string
  contributions?: Array<{ stat: string; amount: unknown; duration?: string }>
}

/** A stat's names by the data's key; a key the vocabulary lacks reads as itself. */
const STAT_NAMES: Readonly<Record<string, StatLabel | undefined>> = STAT_LABELS

function statName(key: string): string {
  return STAT_NAMES[key]?.label ?? key
}

function describe(c: { stat: string; amount: unknown }): string {
  const stat = statName(c.stat)
  if (typeof c.amount === 'number') return `+${c.amount} ${stat}`
  if (c.amount && typeof c.amount === 'object' && 'fromStat' in c.amount) {
    return libRulesCopy('statByThisMechs', {
      stat,
      from: statName(String((c.amount as { fromStat: string }).fromStat)),
    })
  }
  return `changes ${stat}`
}

type Said = { content?: Array<{ type?: string; value?: unknown }>; activationCost?: unknown }

/**
 * The rule's line: the first sentence that says what activating it does, else
 * the first sentence (a record's first lines are often its colour).
 */
function ruleOf(records: readonly Said[]): string | null {
  const sentences = records.flatMap((record) =>
    (record.content ?? []).flatMap((b) =>
      b.type === 'paragraph' && typeof b.value === 'string'
        ? (b.value.match(/[^.!?]+[.!?]?/g) ?? []).map((t) => t.trim()).filter(Boolean)
        : []
    )
  )
  return sentences.find((t) => /activat/i.test(t)) ?? sentences[0] ?? null
}

function costOf(records: readonly Said[], currency: 'AP' | 'EP'): string | null {
  for (const record of records) {
    const cost = record.activationCost
    if (typeof cost === 'number' ? cost > 0 : typeof cost === 'string' && cost !== '0')
      return `${cost} ${currency}`
  }
  return null
}

function activatedOf(
  record: WithContributions | undefined,
  ref: string,
  source: ActivatableEffect['source']
): ActivatableEffect[] {
  const said: Said[] =
    record === undefined
      ? []
      : [
          record as Said,
          ...((SalvageUnionReference.resolveActions(record as never) ?? []) as Said[]),
        ]
  return (record?.contributions ?? [])
    .filter((c) => c.duration === 'activated')
    .map((c) => ({
      ref,
      name: record?.name ?? ref,
      summary: describe(c),
      rule: ruleOf(said),
      cost: costOf(said, source === 'ability' ? 'AP' : 'EP'),
      source,
    }))
}

/**
 * Every activated contribution reachable from this mech's installed loadout and
 * its pilot's abilities, de-duplicated by ref.
 */
export function activatableEffects(
  mech: Pick<Mech, 'systems' | 'modules'>,
  pilotAbilities: string[] | undefined
): ActivatableEffect[] {
  const out = new Map<string, ActivatableEffect>()

  const installed = [...(mech.systems ?? []), ...(mech.modules ?? [])]
  for (const ref of installed) {
    const item = (resolveInstalledRef(ref) ?? undefined) as WithContributions | undefined
    for (const e of activatedOf(item, ref, 'item')) out.set(e.ref, e)
  }

  for (const ref of pilotAbilities ?? []) {
    const ability = SalvageUnionReference.Abilities.getBySlug(ref) as WithContributions | undefined
    for (const e of activatedOf(ability, ref, 'ability')) out.set(e.ref, e)
  }

  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}
