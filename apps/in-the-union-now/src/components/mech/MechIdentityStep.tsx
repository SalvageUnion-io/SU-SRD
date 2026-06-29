import { Field, Input } from 'suref-react'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import { cn } from '../../lib/utils'
import { CargoLotEditor } from './CargoLotEditor'

type MechIdentityStepProps = {
  name: string
  onNameChange: (name: string) => void
  cargoLots: CargoLot[]
  onCargoChange: (lots: CargoLot[]) => void
  /** Cargo capacity from the chassis — soft cap, shown but never enforced. */
  cargoMax: number
}

/**
 * Identity step (design §3.2 — mech Identity is undrawn; reuses the pilot
 * form pattern): max-w-760 form with the required mech name, plus starting
 * cargo as cargo lots. Over-capacity reads in rust but never blocks.
 */
export function MechIdentityStep({
  name,
  onNameChange,
  cargoLots,
  onCargoChange,
  cargoMax,
}: MechIdentityStepProps) {
  const cargoUsed = totalLotUnits(cargoLots)
  const isOver = cargoUsed > cargoMax

  return (
    <div className="max-w-3xl space-y-6">
      <Field label="Mech name" required htmlFor="mech-name">
        <Input
          id="mech-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Iron Fist"
          required
        />
      </Field>

      <section>
        <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[0.12em] text-ink">
          Cargo ·{' '}
          <span className={cn('font-body text-xs font-bold', isOver ? 'text-status-bad' : '')}>
            {cargoUsed} / {cargoMax} slots
          </span>
        </h2>
        <CargoLotEditor lots={cargoLots} onChange={onCargoChange} />
      </section>
    </div>
  )
}
