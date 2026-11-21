/**
 * What a mech sheet's sticky bar reads (r2 G7). In Edit it reads the build,
 * since that is what is being changed under it: slots filled and what the
 * build costs in Scrap. Otherwise the table's numbers; on phones the bar
 * leads with Heat + SP, and EP and Cargo fold until the sm breakpoint.
 * Either way what it carries is Cargo, the vitals' own word.
 */
import type { Mech } from 'game-domain/schemas/mech'
import { STAT_LABELS } from 'salvageunion-reference'
import { loadoutSlots } from '../../lib/patterns/patterns'
import { mechScrap } from '../../lib/rules/mechScrap'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { LiveSheetStripItem } from './LiveSheet'

export function mechBarStrip(args: {
  /** Edit, on a sheet the viewer can write. */
  building: boolean
  mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>
  /** The table's numbers (SP, EP, Heat), as the caller resolved them. */
  vitals: readonly LiveSheetStripItem[]
  cargo: { value: number; max: number }
}): LiveSheetStripItem[] {
  const cargo: LiveSheetStripItem = {
    key: 'cargo',
    label: STAT_LABELS.cargoCapacity.short,
    ...args.cargo,
    mobilePriority: false,
  }
  if (!args.building) return [...args.vitals, cargo]
  const slots = loadoutSlots(args.mech)
  return [
    {
      key: 'systemSlots',
      label: STAT_LABELS.systemSlots.short,
      value: slots.systemSlotsUsed,
      max: slots.systemSlotsMax,
    },
    {
      key: 'moduleSlots',
      label: STAT_LABELS.moduleSlots.short,
      value: slots.moduleSlotsUsed,
      max: slots.moduleSlotsMax,
    },
    { key: 'scrap', label: buildSheetCopy('scrap'), value: mechScrap(args.mech).total },
    cargo,
  ]
}
