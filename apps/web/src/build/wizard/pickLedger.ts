import type { ReactNode } from 'react'
import type { LedgerColumn, Paint } from '../../components/index'

/** A wizard list's column: a Ledger column that reads its value off the row's own record. */
export type PickColumn<T> = Omit<LedgerColumn, 'kind'> & {
  /** `figure` when left out. */
  kind?: LedgerColumn['kind']
  /** An empty value (`''`, null, undefined) draws a dash. */
  value: (row: T) => ReactNode
}

/** The wizard's band paint (`--tone`, the kind's colour), for a Ledger in it. */
export const WIZ_PAINT: Paint = {
  background: 'var(--tone-band, var(--tone))',
  color: 'var(--on-tone-band, var(--color-ink))',
  ink: false,
}

/** The Ledger's columns for a wizard list's. */
export function ledgerColumns<T>(columns: readonly PickColumn<T>[]): LedgerColumn[] {
  return columns.map(({ value: _value, kind, ...column }) => ({
    ...column,
    kind: kind ?? 'figure',
  }))
}
