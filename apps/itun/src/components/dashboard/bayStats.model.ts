/** A `label | value` reading in a Dashboard bay. */
export type BandStat = { label: string; value: string | number }

/** A damaged thing's instance: its Token greys (`instance.condition`). */
export const DAMAGED = { condition: 'damaged' } as const
