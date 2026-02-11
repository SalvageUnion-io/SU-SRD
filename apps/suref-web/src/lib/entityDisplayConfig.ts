/**
 * Shared EntityDisplay prop presets for the reference site.
 * Use via spread: <EntityDisplay {...REFERENCE_COMPACT_PROPS} data={item} />
 */

export const REFERENCE_COMPACT_PROPS = {
  hideActions: true,
  hideChoices: true,
  compact: true,
  collapsible: false,
} as const

export const REFERENCE_DETAIL_PROPS = {
  compact: false,
  collapsible: false,
} as const
