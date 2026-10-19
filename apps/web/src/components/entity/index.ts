/**
 * The entity module's face (hard rule R7, EDL E15): the parts of the forms
 * that the rest of the library composes into its own strips and heads. A
 * Slab's summary and a titled box's band are `Chips`, a titled container's band
 * is the Row's `Head` and its art column the Row's `Art`, a dialog wears an
 * entity's `paintFor`. Everything else
 * under `parts/` is the forms' own, and Biome's `noRestrictedImports` refuses
 * an `entity/parts` path outside `components/entity/`. The forms themselves
 * (`Row`, `RowFrame`, `Token`, `Entity`) are imported from `forms/` and the
 * module root by their own paths; the app outside `components/` takes all of
 * it through the components barrel. A static page's island runtime takes the
 * forms' no-React halves from `staticRuntime.ts`.
 */

export { Art } from './parts/Art'
export { actionTypeStamps } from './parts/actionStamps'
export { Chips } from './parts/Chips'
export type { ChipSet } from './parts/chipSet'
export { costCell } from './parts/chipSet'
export { EntityStat } from './parts/EntityStat'
export { factCells } from './parts/factCells'
export { Head } from './parts/Head'
export { KindLabel } from './parts/KindLabel'
export { Lead } from './parts/Lead'
export { PeekCell } from './parts/PeekCell'
export type { Paint } from './parts/paint'
export { paintFor } from './parts/paint'
export { Tag, Tags } from './parts/Tags'
export type { TagItem } from './parts/tagItems'
export { mentionRef, relation, traitTags } from './parts/tagItems'
export { TILE_NAME, TILE_NAME_CAPS } from './parts/tileName'
