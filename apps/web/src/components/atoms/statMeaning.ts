import type { ReactNode } from 'react'
import { createContext } from 'react'

/**
 * How a sheet's stat label explains itself (r4 E21): given the stat's key
 * (`hp`, `tp`, `inventory`) and its label, the label as the control that
 * opens its definition. None provided, a label only reads. The sheet provides
 * it (`compositions/StatMeanings.tsx`); the atoms that draw a label read it.
 */
export const StatMeaningContext = createContext<
  ((key: string, label: ReactNode) => ReactNode) | null
>(null)
