/**
 * foundryActor — a pilot or a mech as an Actor for Foundry VTT's unofficial
 * Salvage Union system (`salvage-union` 1.3.0, by demondownload and
 * Stexinator: gitlab.com/pacosgrove1/salvage-union-foundry-vtt-unofficial).
 *
 * The file is Foundry's own export shape (`Actor#exportToJSON`), so a player
 * creates an empty Pilot or Mech actor and picks "Import Data" on it. Every
 * field below is one the system's `template.json` declares; nothing is added
 * to the actor that the system would not write itself, save one flag naming
 * where it came from.
 *
 * Two facts about that system shape the mapping:
 *
 *   - **A mech's maxima come from its chassis Item.** `prepareData` reads SP,
 *     EP and Heat max and the cargo capacity off the chassis, and adds each
 *     system's and module's own `cargo`. So the chassis Item carries this mech's
 *     DERIVED maxima (heat sinks, holds and Beefcake included), and installed
 *     items carry 0 cargo, so the Foundry sheet shows the numbers this one does.
 *   - **Items are copies, not compendium links.** Each ability, piece of
 *     equipment, system and module carries its stats, traits and rules text, so
 *     the actor reads the same in a world without the system's compendiums.
 *
 * Pure: no React, no store. The reference data must be loaded (`preload`).
 */

import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { RefEntity, RefObjectContentBlock, RefObjectTrait } from 'salvageunion-reference'
import {
  getEntitySlug,
  getInventorySlots,
  parseContentBlockString,
  plainTraitText,
  SalvageUnionReference,
} from 'salvageunion-reference'
import {
  mechMaxCargo,
  pilotMaxInventorySlots,
  resolveGauge,
  resolveModuleRef,
  resolvePool,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { SITE_URL } from '../constants'
import { itemHref } from '../entityHref'
import { fileStem } from './downloadJson'

/** The Foundry system this file is written for, as its `system.json` names it. */
const FOUNDRY_SYSTEM = { id: 'salvage-union', version: '1.3.0' } as const

/** The one flag scope this export writes. */
const FLAG_SCOPE = 'salvageunion-io'

type Action = NonNullable<ReturnType<typeof SalvageUnionReference.resolveActions>>[number]

/** A Foundry embedded Item, as `Item#toObject` writes one. */
type FoundryItem = {
  name: string
  type: 'ability' | 'equipment' | 'chassis' | 'system' | 'module' | 'salvage'
  img: string
  system: Record<string, unknown>
  effects: []
  flags: Record<string, Record<string, unknown>>
}

/** A Foundry Actor, as `Actor#exportToJSON` writes one. */
export type FoundryActor = {
  name: string
  type: 'pilot' | 'mech'
  img: string
  system: Record<string, unknown>
  items: FoundryItem[]
  effects: []
  flags: Record<string, Record<string, unknown>>
  prototypeToken: { name: string; actorLink: true; texture: { src: string } }
  _stats: { systemId: string; systemVersion: string }
}

/** The system's default token art (`CONFIG.SALVAGE.defaultTokens`). */
function token(type: string): string {
  return `systems/${FOUNDRY_SYSTEM.id}/images/tokens/${type}.webp`
}

// — Codes the system's selects store (`module/config.js`). —

const ACTION_CODES: Partial<Record<string, string>> = {
  Passive: 'p',
  Free: 'f',
  Reaction: 'r',
  Turn: 't',
  Short: 's',
  Long: 'l',
  DownTime: 'd',
}

const RANGE_CODES: Partial<Record<string, string>> = {
  Close: 'close',
  Medium: 'medium',
  Long: 'long',
  Far: 'far',
}

const CONDITION_STATUS = { intact: 0, damaged: 1, destroyed: 2 } as const

/** A Tech Level as the system's select stores it: `T1` … `T6`, `TB`, `N`. */
function techLevelCode(techLevel: unknown): string {
  if (typeof techLevel === 'number') return `T${techLevel}`
  if (techLevel === 'B') return 'TB'
  return 'N'
}

/** A trait as the system lists one: "Multi-Attack", "Hot (2)". */
function traitLabel(trait: RefObjectTrait): string {
  const name = trait.type.replace(
    /(^|[\s-])([a-z])/g,
    (_, gap: string, letter: string) => `${gap}${letter.toUpperCase()}`
  )
  return trait.amount == null ? name : `${name} (${trait.amount})`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** One block's words, references read as plain words, escaped for HTML. */
function blockText(block: RefObjectContentBlock, chassisName?: string): string {
  return escapeHtml(plainTraitText(parseContentBlockString(block, chassisName)))
}

/**
 * Content blocks as the HTML a Foundry ProseMirror field holds: paragraphs,
 * headings, lists and flavour in italics. A choice block is the sheet's own
 * control, with nothing to say in a copy.
 */
export function contentHtml(content: readonly RefObjectContentBlock[] | undefined): string {
  const out: string[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length > 0) out.push(`<ul>${list.join('')}</ul>`)
    list = []
  }
  for (const block of content ?? []) {
    if (block.type === 'list-item') {
      list.push(`<li>${blockText(block)}</li>`)
      continue
    }
    flush()
    if (block.type === 'heading') out.push(`<h3>${blockText(block)}</h3>`)
    else if (block.type === 'flavor') out.push(`<p><em>${blockText(block)}</em></p>`)
    else if (block.type === 'datavalues' && Array.isArray(block.value)) {
      const values = block.value.map((dv) =>
        escapeHtml(`${dv.label}: ${dv.value ?? ''}${dv.unit ? ` ${dv.unit}` : ''}`)
      )
      out.push(`<p>${values.join('<br>')}</p>`)
    } else if (block.type !== 'choice' && typeof block.value === 'string') {
      const label = block.label ? `<strong>${escapeHtml(block.label)}:</strong> ` : ''
      out.push(`<p>${label}${blockText(block)}</p>`)
    }
  }
  flush()
  return out.join('\n')
}

/** An action's line of facts, as a card prints it: "Turn Action · Range Close · 2 SP". */
function actionFacts(action: Action, currency: 'AP' | 'EP'): string {
  const parts: string[] = []
  if (action.actionType)
    parts.push(action.actionType === 'DownTime' ? 'Downtime' : action.actionType)
  if (action.activationCost != null) parts.push(`${action.activationCost} ${currency}`)
  if (action.range) parts.push(`Range ${action.range.join('/')}`)
  if (action.damage) parts.push(`${action.damage.amount} ${action.damage.damageType}`)
  if (action.traits?.length) parts.push(action.traits.map(traitLabel).join(', '))
  return parts.join(' · ')
}

/**
 * An entity's rules text: its own content, then each of its actions. An action
 * named for the entity is the entity's own text; any other is headed by name
 * with its line of facts, since the Item's fields hold only the first.
 */
function rulesHtml(entity: RefEntity, actions: Action[], currency: 'AP' | 'EP'): string {
  const parts = [contentHtml('content' in entity ? entity.content : undefined)]
  for (const action of actions) {
    if (action.name !== entity.name || actions.length > 1) {
      parts.push(`<h3>${escapeHtml(action.name)}</h3>`)
      const facts = actionFacts(action, currency)
      if (facts) parts.push(`<p><strong>${escapeHtml(facts)}</strong></p>`)
    }
    parts.push(contentHtml(action.content))
  }
  return parts.filter((part) => part.length > 0).join('\n')
}

function sourceLine(entity: RefEntity): string {
  const source = 'source' in entity ? String(entity.source) : ''
  const page = 'page' in entity && entity.page != null ? ` p.${entity.page}` : ''
  return source ? `<p><em>${escapeHtml(`${source}${page}`)}</em></p>` : ''
}

function refFlag(schemaName: string, entity: RefEntity): FoundryItem['flags'] {
  const slug = getEntitySlug(entity)
  return {
    [FLAG_SCOPE]: { ref: `${schemaName}/${slug}`, url: `${SITE_URL}${itemHref(schemaName, slug)}` },
  }
}

function visibleActions(entity: RefEntity): Action[] {
  return (SalvageUnionReference.resolveActions(entity) ?? []).filter((action) => !action.hidden)
}

/** The fields every carried or installed Item shares, from its first action. */
function actionFields(entity: RefEntity, actions: Action[]) {
  const first = actions[0]
  const traits = [
    ...('traits' in entity && Array.isArray(entity.traits) ? entity.traits : []),
    ...(first?.traits ?? []),
  ] as RefObjectTrait[]
  const uses = traits.find((trait) => trait.type === 'uses' && typeof trait.amount === 'number')
  const hot = traits.find((trait) => trait.type === 'hot' && typeof trait.amount === 'number')
  const damage = first?.damage
  return {
    action: (first?.actionType && ACTION_CODES[first.actionType]) ?? '',
    range: (first?.range?.[0] && RANGE_CODES[first.range[0]]) ?? '',
    damage: damage ? `${damage.amount} ${damage.damageType}` : '',
    cost: first?.activationCost == null ? '' : String(first.activationCost),
    traits: traits.filter((trait) => trait.type !== 'uses').map(traitLabel),
    usesMax: typeof uses?.amount === 'number' ? uses.amount : 0,
    heat: typeof hot?.amount === 'number' ? hot.amount : 0,
  }
}

function abilityLevel(entity: RefEntity): 'core' | 'advanced' | 'legendary' {
  const tree = 'tree' in entity ? String(entity.tree) : ''
  if (tree.includes('Legendary') || ('level' in entity && entity.level === 'L')) return 'legendary'
  const hybrid = SalvageUnionReference.Classes.all().some(
    (cls) => cls.hybrid && 'advancedTree' in cls && cls.advancedTree === tree
  )
  if (tree.includes('Advanced') || hybrid) return 'advanced'
  return 'core'
}

// — Pilot —

function abilityItem(slug: string): FoundryItem | null {
  const ability = SalvageUnionReference.Abilities.getBySlug(slug)
  if (!ability) return null
  const actions = visibleActions(ability)
  const fields = actionFields(ability, actions)
  return {
    name: ability.name,
    type: 'ability',
    img: token('ability'),
    system: {
      description: [rulesHtml(ability, actions, 'AP'), sourceLine(ability)].join('\n').trim(),
      level: abilityLevel(ability),
      ap: fields.cost,
      action: fields.action,
      range: fields.range,
      traits: fields.traits,
      uses: { value: fields.usesMax, max: fields.usesMax },
      inventorySlots: 0,
      table_id: '',
      visible: true,
    },
    effects: [],
    flags: refFlag('abilities', ability),
  }
}

function equipmentItem(slug: string, pilot: Pilot): FoundryItem | null {
  const equipment = SalvageUnionReference.Equipment.getBySlug(slug)
  if (!equipment) return null
  const actions = visibleActions(equipment)
  const fields = actionFields(equipment, actions)
  return {
    name: equipment.name,
    type: 'equipment',
    img: token('equipment'),
    system: {
      description: [rulesHtml(equipment, actions, 'AP'), sourceLine(equipment)].join('\n').trim(),
      techLevel: techLevelCode(equipment.techLevel),
      inventorySlots: getInventorySlots(equipment),
      ap: fields.cost,
      action: fields.action,
      range: fields.range,
      damage: fields.damage,
      traits: fields.traits,
      uses: { value: pilot.equipmentUses?.[slug] ?? fields.usesMax, max: fields.usesMax },
      table_id: '',
      visible: true,
    },
    effects: [],
    flags: refFlag('equipment', equipment),
  }
}

/** A free-form inventory entry (Scrap and the like): its name and its slots. */
function carriedItem(entry: NonNullable<Pilot['genericInventory']>[number]): FoundryItem {
  const name = entry.qty && entry.qty > 1 ? `${entry.name} ×${entry.qty}` : entry.name
  return {
    name,
    type: 'equipment',
    img: token('equipment'),
    system: {
      description: entry.note ? `<p>${escapeHtml(entry.note)}</p>` : '',
      techLevel: 'N',
      inventorySlots: entry.slotCost,
      ap: '',
      action: '',
      range: '',
      damage: '',
      traits: [],
      uses: { value: 0, max: 0 },
      table_id: '',
      visible: true,
    },
    effects: [],
    flags: {},
  }
}

function actorShell(type: 'pilot' | 'mech', name: string, entityId: string) {
  return {
    name,
    type,
    img: token(type),
    effects: [] as [],
    flags: { [FLAG_SCOPE]: { kind: type, id: entityId } },
    prototypeToken: { name, actorLink: true as const, texture: { src: token(type) } },
    _stats: { systemId: FOUNDRY_SYSTEM.id, systemVersion: FOUNDRY_SYSTEM.version },
  }
}

/**
 * A pilot as a Foundry Pilot actor. `crawler` is the one they crew, which sets
 * the Stat Training bonus to their maxima, as on their sheet.
 */
export function pilotToFoundry(
  pilot: Pilot,
  crawler: Pick<Crawler, 'techLevel'> | null
): FoundryActor {
  const { statInput, maxHP, maxAP } = pilotMaxima(pilot, crawler)
  const pilotClass = SalvageUnionReference.Classes.getBySlug(pilot.classRef)
  const items = [
    ...pilot.abilities.map(abilityItem),
    ...pilot.equipment.map((slug) => equipmentItem(slug, pilot)),
  ].filter((item): item is FoundryItem => item !== null)
  return {
    ...actorShell('pilot', pilot.name, pilot.id),
    system: {
      callsign: pilot.callsign,
      class: pilotClass?.name ?? '',
      background: pilot.background,
      backgroundUsed: pilot.usedToggles?.background ?? false,
      keepsake: pilot.keepsake,
      keepsakeUsed: pilot.usedToggles?.keepsake ?? false,
      motto: pilot.motto,
      mottoUsed: pilot.usedToggles?.motto ?? false,
      appearance: pilot.appearance,
      hp: { value: resolvePool(pilot.currentHP, maxHP), max: maxHP },
      'ability-points': { value: resolvePool(pilot.currentAP, maxAP), max: maxAP },
      inventorySlots: pilotMaxInventorySlots(statInput),
      skillPoints: pilot.trainingPoints ?? 0,
      healthType: 'hp',
    },
    items: [...items, ...(pilot.genericInventory ?? []).map(carriedItem)],
  }
}

// — Mech —

function installedItem(slug: string, kind: 'system' | 'module', mech: Mech): FoundryItem | null {
  const entity = kind === 'system' ? resolveSystemRef(slug) : resolveModuleRef(slug)
  if (!entity) return null
  const actions = visibleActions(entity)
  const fields = actionFields(entity, actions)
  const conditions = kind === 'system' ? mech.systemConditions : mech.moduleConditions
  return {
    name: entity.name,
    type: kind,
    img: token(kind),
    system: {
      description: [rulesHtml(entity, actions, 'EP'), sourceLine(entity)].join('\n').trim(),
      techLevel: techLevelCode(entity.techLevel),
      ep: fields.cost,
      heat: fields.heat,
      slots: entity.slotsRequired ?? 0,
      cargo: 0,
      salvageValue: entity.salvageValue ?? 0,
      status: CONDITION_STATUS[conditions?.[slug] ?? 'intact'],
      action: fields.action,
      range: fields.range,
      damage: fields.damage,
      traits: fields.traits,
      uses: { value: mech.itemUses?.[slug] ?? fields.usesMax, max: fields.usesMax },
      table_id: '',
      visible: true,
    },
    effects: [],
    flags: refFlag(kind === 'system' ? 'systems' : 'modules', entity),
  }
}

/** A cargo lot as the system's Salvage: one item, its size the lot's slots. */
function cargoItem(lot: Mech['cargoLots'][number]): FoundryItem {
  const name = lot.qty && lot.qty > 1 ? `${lot.name} ×${lot.qty}` : lot.name
  return {
    name,
    type: 'salvage',
    img: token('salvage'),
    system: {
      description: `<p>${escapeHtml(`${lot.cat} · ${lot.code}`)}</p>`,
      techLevel: lot.tl ? `T${lot.tl}` : 'N',
      salvageValue: lot.units,
    },
    effects: [],
    flags: {},
  }
}

/**
 * A mech as a Foundry Mech actor. `pilotAbilities` are its pilot's, since a
 * pilot ability can raise the mech's maxima (Beefcake, ADR-029).
 */
export function mechToFoundry(mech: Mech, pilotAbilities: string[] | undefined): FoundryActor {
  const { chassis, piloting, maxSP, maxEP, maxHeat } = mechMaxima(mech, pilotAbilities, [])
  const items: FoundryItem[] = []
  const chassisRef = chassis
  if (chassisRef) {
    const abilities = visibleActions(chassisRef)
    items.push({
      name: chassisRef.name,
      type: 'chassis',
      img: token('chassis'),
      system: {
        description: [rulesHtml(chassisRef, abilities, 'EP'), sourceLine(chassisRef)]
          .join('\n')
          .trim(),
        techLevel: techLevelCode(chassisRef.techLevel),
        sp: maxSP,
        ep: maxEP,
        heat: maxHeat,
        cargo: mechMaxCargo(mech, chassis, piloting),
        systemSlots: chassisRef.systemSlots ?? 0,
        moduleSlots: chassisRef.moduleSlots ?? 0,
        salvageValue: chassisRef.salvageValue ?? 0,
        slots: 0,
        status: 0,
        size: 'standard',
        displayName: '',
        table_id: '',
        visible: true,
      },
      effects: [],
      flags: refFlag('chassis', chassisRef),
    })
  }
  for (const slug of mech.systems) {
    const item = installedItem(slug, 'system', mech)
    if (item) items.push(item)
  }
  for (const slug of mech.modules) {
    const item = installedItem(slug, 'module', mech)
    if (item) items.push(item)
  }
  const pattern = mech.patternName
    ? `<p><strong>Pattern:</strong> ${escapeHtml(`"${mech.patternName}"`)}</p>`
    : ''
  const description = mech.description ? `<p>${escapeHtml(mech.description)}</p>` : ''
  return {
    ...actorShell('mech', mech.name, mech.id),
    system: {
      description: [pattern, description].join('\n').trim(),
      quirk: mech.quirk ?? '',
      appearance: mech.appearance ?? '',
      sp: { value: resolvePool(mech.currentSP, maxSP), max: maxSP },
      'energy-points': { value: resolvePool(mech.currentEP, maxEP), max: maxEP },
      heat: { value: resolveGauge(mech.currentHeat, maxHeat), max: maxHeat },
      'system-slots': chassisRef?.systemSlots ?? 0,
      'module-slots': chassisRef?.moduleSlots ?? 0,
    },
    items: [...items, ...mech.cargoLots.map(cargoItem)],
  }
}

/** The file's name: "fvtt-salvage-union-pilot-bonesaw.json". */
export function foundryFileName(kind: 'pilot' | 'mech', name: string): string {
  return `fvtt-salvage-union-${kind}-${fileStem(name)}.json`
}
