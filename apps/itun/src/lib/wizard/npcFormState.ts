/**
 * The NPC designer's form (board N1; `docs/architecture/npc-builder.md` §4.1):
 * five steps, a template that fills the stat block, and the projection to the
 * store's create input.
 *
 * Pure: the designer component owns the state, this owns what it means. The
 * draft serialises to sessionStorage through `wizardDraft.ts`, as the other
 * wizards' do.
 */

import type { SURefNPC } from 'salvageunion-reference'
import type { CreateInput } from '../../stores/types'
import type { NpcStatFill } from '../npcs/npcModel'
import { statFillFromReference } from '../npcs/npcModel'
import type { Npc, NpcTemplateRef, NpcTrait } from '../schemas/npc'

/** The designer's steps, in order (issue 1269 §4.1). */
export const NPC_STEPS = ['template', 'stats', 'actions', 'identity', 'review'] as const
export type NpcStepId = (typeof NPC_STEPS)[number]

export const NPC_STEP_LABELS: Record<NpcStepId, string> = {
  template: 'Template',
  stats: 'Stats',
  actions: 'Actions & traits',
  identity: 'Identity',
  review: 'Review',
}

export type NpcFormState = {
  /** Null until a template (or "Start blank") is chosen. */
  templateRef: NpcTemplateRef | null
  /** Whether the template step has been answered — a blank start included. */
  templateChosen: boolean
  name: string
  position: string
  description: string
  keepsake: string
  motto: string
  /**
   * Kept as text while typed, so an emptied field reads as empty rather than
   * as 0; `npcFormToCreateInput` reads it as a number.
   */
  hitPoints: string
  damageType: 'HP' | 'SP'
  bioSalvageValue: string
  /** The action slugs this NPC carries (checked). */
  actions: string[]
  /** The traits this NPC carries (checked). */
  traits: NpcTrait[]
  /**
   * Every action offered on the Actions & traits step: the template's, plus
   * any the search added. Unchecking one keeps it here, so it can be checked
   * again; only `actions` is saved.
   */
  offeredActions: string[]
  offeredTraits: NpcTrait[]
  /**
   * The stat block as the template last filled it, so "Change" knows whether
   * the player has edited it since (D4: ask before re-filling only then).
   */
  filledFrom: NpcStatFill | null
  /**
   * The description the template last wrote, so changing the template
   * replaces it only while the player has not touched it. Absent in a draft
   * saved before it existed.
   */
  filledDescription?: string
}

export const EMPTY_NPC_FORM: NpcFormState = {
  templateRef: null,
  templateChosen: false,
  name: '',
  position: '',
  description: '',
  keepsake: '',
  motto: '',
  hitPoints: '',
  damageType: 'HP',
  bioSalvageValue: '',
  actions: [],
  traits: [],
  offeredActions: [],
  offeredTraits: [],
  filledFrom: null,
  filledDescription: '',
}

/** The stat block as the form holds it, comparable with a template's fill. */
function statsOf(form: NpcFormState) {
  return {
    hitPoints: form.hitPoints,
    damageType: form.damageType,
    bioSalvageValue: form.bioSalvageValue,
    actions: form.actions,
    traits: form.traits,
  }
}

function statsOfFill(fill: NpcStatFill) {
  return {
    hitPoints: String(fill.hitPoints),
    damageType: fill.damageType,
    bioSalvageValue: fill.bioSalvageValue === undefined ? '' : String(fill.bioSalvageValue),
    actions: fill.actions,
    traits: fill.traits,
  }
}

/**
 * Whether the player changed Stats or Actions & traits since the template last
 * filled them. Changing the template asks first only when this is true (D4).
 */
export function statsEditedSinceFill(form: NpcFormState): boolean {
  const baseline = form.filledFrom === null ? BLANK_STATS : statsOfFill(form.filledFrom)
  return JSON.stringify(statsOf(form)) !== JSON.stringify(baseline)
}

/** The stat block of a blank start: nothing filled, HP still to set. */
const BLANK_STATS: ReturnType<typeof statsOf> = {
  hitPoints: '',
  damageType: 'HP',
  bioSalvageValue: '',
  actions: [],
  traits: [],
}

/** A reference NPC's own description: its first paragraph. */
export function npcTemplateProse(ref: SURefNPC | undefined): string {
  const first = ref?.content?.find((b) => b.type === 'paragraph')
  return typeof first?.value === 'string' ? first.value : ''
}

/** Whether the description is empty or still what the last template wrote. */
function untouchedDescription(form: NpcFormState): boolean {
  return form.description.trim() === '' || form.description === (form.filledDescription ?? '')
}

/**
 * Apply a reference template: it fills Stats and Actions & traits, keeps the
 * Identity the player wrote (D4), and pre-fills the description with the
 * template's own words until the player changes them (D5).
 */
export function applyNpcTemplate(form: NpcFormState, ref: SURefNPC): NpcFormState {
  const fill = statFillFromReference(ref)
  const prose = npcTemplateProse(ref)
  return {
    ...form,
    description: untouchedDescription(form) ? prose : form.description,
    filledDescription: prose,
    templateRef: fill.templateRef,
    templateChosen: true,
    ...statsOfFill(fill),
    offeredActions: fill.actions,
    offeredTraits: fill.traits,
    filledFrom: fill,
  }
}

/** Carry an action from the reference: offered, and checked. */
export function addNpcAction(form: NpcFormState, slug: string): NpcFormState {
  return {
    ...form,
    offeredActions: form.offeredActions.includes(slug)
      ? form.offeredActions
      : [...form.offeredActions, slug],
    actions: form.actions.includes(slug) ? form.actions : [...form.actions, slug],
  }
}

/** Check or uncheck an offered action. */
export function toggleNpcAction(form: NpcFormState, slug: string, carried: boolean): NpcFormState {
  const actions = form.actions.filter((a) => a !== slug)
  if (!carried) return { ...form, actions }
  // Keep the offered order, so a re-checked action returns to its place.
  const order = form.offeredActions
  return {
    ...form,
    actions: [...actions, slug].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
  }
}

/**
 * Carry a trait from the reference. A trait added by search carries no amount:
 * an amount comes only from a template, and is never typed (D6).
 */
export function addNpcTrait(form: NpcFormState, type: string): NpcFormState {
  const has = (list: readonly NpcTrait[]) => list.some((t) => t.type === type)
  const trait: NpcTrait = { type }
  return {
    ...form,
    offeredTraits: has(form.offeredTraits) ? form.offeredTraits : [...form.offeredTraits, trait],
    traits: has(form.traits) ? form.traits : [...form.traits, trait],
  }
}

/** Check or uncheck an offered trait (matched by its type). */
export function toggleNpcTrait(form: NpcFormState, type: string, carried: boolean): NpcFormState {
  const traits = form.traits.filter((t) => t.type !== type)
  if (!carried) return { ...form, traits }
  const offered = form.offeredTraits.find((t) => t.type === type) ?? { type }
  const order = form.offeredTraits.map((t) => t.type)
  return {
    ...form,
    traits: [...traits, offered].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type)),
  }
}

/** Start blank: no template, an empty stat block, Identity kept. */
export function applyBlankStart(form: NpcFormState): NpcFormState {
  return {
    ...form,
    templateRef: null,
    templateChosen: true,
    hitPoints: '',
    damageType: 'HP',
    bioSalvageValue: '',
    actions: [],
    traits: [],
    offeredActions: [],
    offeredTraits: [],
    filledFrom: null,
    description: untouchedDescription(form) ? '' : form.description,
    filledDescription: '',
  }
}

/** A whole, non-negative number typed into a field, or null when it is not one. */
export function parseCount(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

/** The draft as the renderers read it (`NpcView`), for the live preview. */
export function npcFormView(form: NpcFormState) {
  const bio = parseCount(form.bioSalvageValue)
  return {
    name: form.name,
    position: form.position,
    description: form.description,
    keepsake: form.keepsake,
    motto: form.motto,
    hitPoints: parseCount(form.hitPoints) ?? 0,
    damageType: form.damageType,
    actions: form.actions,
    traits: form.traits,
    ...(bio === null ? {} : { bioSalvageValue: bio }),
    ...(form.templateRef === null ? {} : { templateRef: form.templateRef }),
  }
}

/** Trim a typed string to the field, or leave the field out. */
function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** The store's create input for the designed NPC. */
export function npcFormToCreateInput(form: NpcFormState): CreateInput<'npc'> {
  const view = npcFormView(form)
  const input: CreateInput<'npc'> = {
    schemaVersion: 1,
    name: form.name.trim(),
    hitPoints: view.hitPoints,
    damageType: form.damageType,
    actions: form.actions,
    traits: form.traits,
  }
  const fields: Partial<Npc> = {
    position: optional(form.position),
    description: optional(form.description),
    keepsake: optional(form.keepsake),
    motto: optional(form.motto),
    bioSalvageValue: view.bioSalvageValue,
    templateRef: form.templateRef ?? undefined,
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) Object.assign(input, { [key]: value })
  }
  return input
}
