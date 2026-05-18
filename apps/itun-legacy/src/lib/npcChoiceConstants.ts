import type { BayNpcData } from '../types/common'

/** String-only keys from BayNpcData (excludes `damaged` boolean and `hp` number) */
export type BayNpcTextField = Exclude<keyof BayNpcData, 'damaged' | 'hp'>

/** Display order for NPC choices */
export const NPC_CHOICE_ORDER = ['Name', 'Description', 'Motto', 'Keepsake', 'A.I. Personality']

/** Choices we render as editable fields */
export const NPC_EDITABLE_CHOICE_TYPES = new Set(['freeform', 'permanent'])

/** Fallback roll table names for choices that don't have rollTable in the data */
export const NPC_ROLL_TABLE_FALLBACK: Record<string, string> = {
  Motto: 'Motto',
  Keepsake: 'Keepsake',
}

/** Choices that are optional (not required for wizard submission) */
export const NPC_OPTIONAL_CHOICES = new Set(['Description'])

/** Choice field names mapped to BayNpcData keys */
export const CHOICE_NAME_TO_FIELD: Record<string, BayNpcTextField> = {
  Name: 'name',
  Description: 'description',
  Motto: 'motto',
  Keepsake: 'keepsake',
  'A.I. Personality': 'personality',
}
