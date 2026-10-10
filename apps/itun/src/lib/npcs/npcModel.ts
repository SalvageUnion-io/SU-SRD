/**
 * What a built NPC is, read against the reference (ADR-043; the model is
 * `docs/architecture/npc-builder.md`).
 *
 * Pure, and the one place these rules live: the designer, the sheet, the
 * roster and the crawler's crew board all read an NPC through here, so "how a
 * built NPC renders as an `npcs` entity", "which crew slots a crawler has" and
 * "is this NPC down" each have one answer.
 *
 * ## Refs, never copies
 *
 * A record stores slugs (`actions`) and the player's own words. Rendering one
 * resolves each slug against `actions.json` and shapes the NPC as a reference
 * `npcs` entity for `ReferenceEntityCard`, so a built NPC's actions read
 * exactly as a reference NPC's do. Nothing from a template's prose is ever
 * copied into the record (D5): the description is what the player wrote.
 */

import type { SURefNPC, SURefObjectChoice } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { resolvePool } from 'salvageunion-reference/rules'
import { slotKey } from '../links/linkRules'
import { readReference } from '../readReference'
import type { Crawler } from '../schemas/crawler'
import type { Npc, NpcTemplateRef, NpcTrait } from '../schemas/npc'
import type { CrewSlot, SoftLink } from '../schemas/softLink'

/** The parts of an NPC the renderers read — a saved record or a designer draft. */
export type NpcView = Pick<
  Npc,
  | 'name'
  | 'position'
  | 'description'
  | 'keepsake'
  | 'motto'
  | 'choiceValues'
  | 'hitPoints'
  | 'damageType'
  | 'actions'
  | 'traits'
  | 'bioSalvageValue'
  | 'templateRef'
> & { id?: string; currentHP?: number }

/** A reference NPC, as `npcs.json` stores one. */
export type ReferenceNpc = SURefNPC & { schemaName: string }

/* -------------------------------------------------------------------------- */
/* Actions: slugs on the record, names in the data                            */
/* -------------------------------------------------------------------------- */

/** The action a stored slug names, or null when the reference has none by it. */
export function resolveNpcAction(slug: string) {
  return readReference(
    'npcModel.resolveNpcAction',
    () => SalvageUnionReference.Actions.getBySlug(slug) ?? null,
    null
  )
}

/** An action's display name: the reference's, or the slug when it cannot be resolved. */
export function npcActionName(slug: string): string {
  return resolveNpcAction(slug)?.name ?? slug
}

/** The slug an action name is stored by (Q3: "a stored ref is a slug, and only a slug"). */
export function npcActionSlug(name: string): string {
  return nameToSlug(name)
}

/* -------------------------------------------------------------------------- */
/* The NPC as a reference entity                                              */
/* -------------------------------------------------------------------------- */

/**
 * The id a draft renders under before it has one. Never stored: the store
 * mints the real id on create.
 */
const DRAFT_ID = 'npc-draft'

/**
 * A built NPC shaped as an `npcs` entity, so `ReferenceEntityCard` renders it
 * through the same path a reference NPC takes: its actions resolved by name,
 * its HP or SP in the header, its traits on the "//" line.
 *
 * `source` and `page` are required by the entity type and never shown: the
 * card is always rendered `userMade`, which drops the citation for "Made by".
 */
export function npcAsReferenceEntity(npc: NpcView): ReferenceNpc {
  const description = npc.description?.trim()
  return {
    id: npc.id ?? DRAFT_ID,
    schemaName: 'npcs',
    name: npc.name.trim() || 'Unnamed NPC',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    hitPoints: npc.hitPoints,
    damageType: npc.damageType,
    actions: npc.actions.map(npcActionName),
    traits: npc.traits,
    ...(npc.bioSalvageValue === undefined ? {} : { bioSalvageValue: npc.bioSalvageValue }),
    ...(description ? { content: [{ type: 'paragraph' as const, value: description }] } : {}),
  }
}

/**
 * The line under the card's header: the NPC's role and the book's crew
 * choices, in the book's "//" voice — "Position: Doc // Keepsake: a dented
 * tin of boiled sweets // Motto: Bleed later." Empty parts drop out.
 */
export function npcIdentityLine(npc: NpcView): string {
  const parts: string[] = []
  if (npc.position?.trim()) parts.push(`Position: ${npc.position.trim()}`)
  if (npc.keepsake?.trim()) parts.push(`Keepsake: ${npc.keepsake.trim()}`)
  if (npc.motto?.trim()) parts.push(`Motto: ${npc.motto.trim()}`)
  for (const [choice, value] of Object.entries(npc.choiceValues ?? {})) {
    if (value.trim()) parts.push(`${choice}: ${value.trim()}`)
  }
  return parts.join(' // ')
}

/** The reference name a template ref points at, or null when it cannot be read. */
function templateName(ref: NpcTemplateRef): string | null {
  return readReference(
    'npcModel.templateName',
    () => {
      if (ref.schema === 'npcs') return SalvageUnionReference.NPCs.getBySlug(ref.slug)?.name ?? null
      if (ref.schema === 'crawler-bays') {
        return SalvageUnionReference.CrawlerBays.getBySlug(ref.slug)?.name ?? null
      }
      return SalvageUnionReference.Crawlers.getBySlug(ref.slug)?.name ?? null
    },
    null
  )
}

/**
 * The kicker the card wears on its seam and in its footer (D9): "NPC · from
 * Veteran" for an NPC built from a reference template, "Crawler crew · Med Bay"
 * for crew, "NPC" for one started blank.
 */
export function npcKicker(npc: Pick<NpcView, 'templateRef'>): string {
  const ref = npc.templateRef
  if (ref === undefined) return 'NPC'
  const name = templateName(ref)
  if (ref.schema === 'npcs') return name === null ? 'NPC' : `NPC · from ${name}`
  if (ref.schema === 'crawler-bays')
    return name === null ? 'Crawler crew' : `Crawler crew · ${name}`
  return name === null ? 'Crawler crew' : `Crawler crew · ${name} type`
}

/* -------------------------------------------------------------------------- */
/* Play state                                                                 */
/* -------------------------------------------------------------------------- */

/** Current HP: absent is full, as on pilots. */
export function npcCurrentHP(npc: Pick<NpcView, 'hitPoints' | 'currentHP'>): number {
  return resolvePool(npc.currentHP, npc.hitPoints)
}

/**
 * Whether an NPC is down (ADR-007; issue 1269 §6): it has HP to lose and has lost
 * it. Shown, never acted on — the app deletes and unlinks nothing. An NPC with
 * max 0 (the Augmented crawler's A.I.) is never down (D2).
 */
export function isNpcDown(npc: Pick<NpcView, 'hitPoints' | 'currentHP'>): boolean {
  return npc.hitPoints >= 1 && npcCurrentHP(npc) === 0
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

/** What a template fills: the stat block. Identity is the player's (D4). */
export type NpcStatFill = Pick<
  Npc,
  'hitPoints' | 'damageType' | 'actions' | 'traits' | 'bioSalvageValue'
> & {
  templateRef: NpcTemplateRef
}

/** A reference NPC's stat block, as a built NPC stores it: actions as slugs (Q3). */
export function statFillFromReference(ref: SURefNPC): NpcStatFill {
  return {
    templateRef: { schema: 'npcs', slug: nameToSlug(ref.name) },
    hitPoints: ref.hitPoints,
    damageType: ref.damageType ?? 'HP',
    actions: (ref.actions ?? []).map(npcActionSlug),
    traits: (ref.traits ?? []).map(
      (t): NpcTrait =>
        t.amount === undefined ? { type: t.type } : { type: t.type, amount: t.amount }
    ),
    ...(ref.bioSalvageValue === undefined ? {} : { bioSalvageValue: ref.bioSalvageValue }),
  }
}

/* -------------------------------------------------------------------------- */
/* Crawler crew slots                                                         */
/* -------------------------------------------------------------------------- */

/** One of a crawler's crew slots: the type's NPC or one bay's (board N2). */
export type CrewSlotView = {
  slot: CrewSlot
  /** `slotKey(slot)`: stable across renders. */
  key: string
  /** "Med Bay", or "Type · Augmented". */
  label: string
  /** The bay's or type's name alone: "Med Bay", "Augmented". */
  name: string
  /** The book's role for the slot: "Doc", "Union Crawler A.I.". */
  position: string
  /** Fixed by the slot's data (D2): 4 for a bay, 0 for the Augmented A.I. */
  hitPoints: number
  /** The slot's own choices, in data order (D3). */
  choices: readonly SURefObjectChoice[]
  templateRef: NpcTemplateRef
  /** The inline crew's name the crawler holds for this slot, if it has one. */
  bookName: string | undefined
}

type EmbeddedNpc = { position: string; hitPoints: number; choices?: SURefObjectChoice[] }

/**
 * Every crew slot a crawler has, type first, then one per bay in the crawler's
 * own order. A bay listed twice is a slot once: a link names a bay by its slug,
 * so only the first entry can be crewed (a known limit, ADR-043).
 */
export function crewSlotsOf(
  crawler: Pick<Crawler, 'type' | 'typeNpc' | 'crawlerBays'>
): CrewSlotView[] {
  const slots: CrewSlotView[] = []
  if (crawler.type) {
    const type = readReference(
      'npcModel.crewSlotsOf.type',
      () => SalvageUnionReference.Crawlers.getBySlug(crawler.type ?? '') ?? null,
      null
    )
    const npc = (type as { npc?: EmbeddedNpc } | null)?.npc
    if (type && npc) {
      const slot: CrewSlot = { kind: 'type' }
      slots.push({
        slot,
        key: slotKey(slot),
        label: `Type · ${type.name}`,
        name: type.name,
        position: npc.position,
        hitPoints: npc.hitPoints,
        choices: npc.choices ?? [],
        templateRef: { schema: 'crawlers', slug: crawler.type },
        bookName: crawler.typeNpc?.npcName?.trim() || undefined,
      })
    }
  }
  const seen = new Set<string>()
  for (const entry of crawler.crawlerBays ?? []) {
    if (seen.has(entry.bayRef)) continue
    seen.add(entry.bayRef)
    const bay = readReference(
      'npcModel.crewSlotsOf.bay',
      () => SalvageUnionReference.CrawlerBays.getBySlug(entry.bayRef) ?? null,
      null
    )
    const npc = (bay as { npc?: EmbeddedNpc } | null)?.npc
    if (!bay || !npc) continue
    const slot: CrewSlot = { kind: 'bay', bayRef: entry.bayRef }
    slots.push({
      slot,
      key: slotKey(slot),
      label: bay.name,
      name: bay.name,
      position: npc.position,
      hitPoints: npc.hitPoints,
      choices: npc.choices ?? [],
      templateRef: { schema: 'crawler-bays', slug: entry.bayRef },
      bookName: entry.npcName?.trim() || undefined,
    })
  }
  return slots
}

/** The crew link filling one slot of a crawler, if any. */
export function crewLinkFor(
  links: readonly SoftLink[],
  crawlerId: string,
  slot: CrewSlot
): SoftLink | undefined {
  const key = slotKey(slot)
  return links.find(
    (l) => l.type === 'npc-to-crawler' && l.to.id === crawlerId && slotKey(l.slot) === key
  )
}

/**
 * A crew slot's assignment as a sheet renders it (Q2): the link, and the NPC
 * it names when this view can read it. `npc` is null when the link is there
 * but its NPC cannot be resolved — the slot then shows its inline crew with an
 * "Assigned NPC unavailable" badge, never a blank.
 */
export type CrewAssignment = {
  link: SoftLink
  slot: CrewSlot
  npcId: string
  npc: Npc | null
}

/** Every crew assignment of one crawler, resolved through `lookupNpc`. */
export function crewAssignmentsOf(
  links: readonly SoftLink[],
  crawlerId: string,
  lookupNpc: (id: string) => Npc | null
): CrewAssignment[] {
  return links
    .filter((l) => l.type === 'npc-to-crawler' && l.to.id === crawlerId && l.slot !== undefined)
    .map((link) => ({
      link,
      slot: link.slot as CrewSlot,
      npcId: link.from.id,
      npc: lookupNpc(link.from.id),
    }))
}

/** The assignment filling one slot, from a crawler's list. */
export function assignmentFor(
  crew: readonly CrewAssignment[] | undefined,
  slot: CrewSlot
): CrewAssignment | undefined {
  const key = slotKey(slot)
  return crew?.find((a) => slotKey(a.slot) === key)
}

/** The crew link an NPC holds, if it crews anything. */
export function crewLinkOf(links: readonly SoftLink[], npcId: string): SoftLink | undefined {
  return links.find((l) => l.type === 'npc-to-crawler' && l.from.id === npcId)
}

/** A slot param (`&slot=<bayRef|type>`, D8) as the slot it names. */
export function slotFromParam(param: string | undefined): CrewSlot | undefined {
  if (!param) return undefined
  return param === 'type' ? { kind: 'type' } : { kind: 'bay', bayRef: param }
}

/** A slot as its URL param. */
export function slotParam(slot: CrewSlot): string {
  return slot.kind === 'type' ? 'type' : slot.bayRef
}

/** A slot's short name: "Med Bay", or "Type NPC". */
export function slotName(slot: CrewSlot): string {
  if (slot.kind === 'type') return 'Type NPC'
  const bay = readReference(
    'npcModel.slotName',
    () => SalvageUnionReference.CrawlerBays.getBySlug(slot.bayRef)?.name ?? null,
    null
  )
  return bay ?? slot.bayRef
}

/** A slot's name for a sentence: "the Med Bay", "the type's NPC slot". */
export function slotPhrase(slot: CrewSlot): string {
  if (slot.kind === 'type') return "the type's NPC slot"
  return `the ${slotName(slot)}`
}
