/**
 * SheetVitalGauge — a Live Sheet's vital (hard rule R11): the shared
 * `VitalGauge`, named from the one map (`sheetVitals.model.ts`), so no sheet
 * words its vitals its own way. `data-vital` names which one it is, for the
 * sheet-grammar e2e.
 */

import type { ComponentProps } from 'react'
import { VitalGauge } from '../../components/index'
import type { SheetVital } from './sheetVitals.model'
import { vitalWords } from './sheetVitals.model'

type SheetVitalGaugeProps = Omit<ComponentProps<typeof VitalGauge>, 'label' | 'subLabel'> & {
  vital: SheetVital
}

export function SheetVitalGauge({ vital, ...gauge }: SheetVitalGaugeProps) {
  return (
    <div data-vital={vital}>
      <VitalGauge {...vitalWords(vital)} {...gauge} />
    </div>
  )
}
