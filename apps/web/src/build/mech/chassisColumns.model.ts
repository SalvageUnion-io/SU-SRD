import type { RefChassis } from 'salvageunion-reference'
import { mechCopy } from '../../messages/build-mech'
import type { PickColumn } from '../wizard/pickLedger.model'

/**
 * A chassis's stats in the one column order (ruleset §2.6): its Salvage Value
 * in place, then its points and slots. What it costs is said once, on the foot.
 * A phone keeps two figures (L8); the pick's card under its list has the rest.
 */
export const CHASSIS_COLUMNS: readonly PickColumn<RefChassis>[] = [
  {
    key: 'sv',
    label: mechCopy('sv'),
    title: mechCopy('salvageValueItsCost'),
    phone: true,
    value: (c) => c.salvageValue,
  },
  {
    key: 'sp',
    label: mechCopy('sp'),
    title: mechCopy('structurePoints'),
    phone: true,
    value: (c) => c.structurePoints,
  },
  {
    key: 'ep',
    label: mechCopy('ep'),
    title: mechCopy('energyPoints'),
    value: (c) => c.energyPoints,
  },
  {
    key: 'sys',
    label: mechCopy('sys'),
    title: mechCopy('systemSlots'),
    value: (c) => c.systemSlots,
  },
  {
    key: 'mod',
    label: mechCopy('mod'),
    title: mechCopy('moduleSlots'),
    value: (c) => c.moduleSlots,
  },
  {
    key: 'heat',
    label: mechCopy('heat'),
    title: mechCopy('heatCapacity'),
    value: (c) => c.heatCapacity,
  },
  {
    key: 'cargo',
    label: mechCopy('cargo'),
    title: mechCopy('cargoCapacity'),
    value: (c) => c.cargoCapacity,
  },
]

/** The chassis step's pattern strip, for the action bar's prompt to scroll to. */
export const PATTERN_STRIP_ID = 'wiz-patterns'
