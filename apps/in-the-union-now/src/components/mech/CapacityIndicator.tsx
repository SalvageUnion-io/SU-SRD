/**
 * CapacityIndicator — sticky sidebar panel showing slot usage and violations.
 *
 * Displays:
 * - System slots used / max
 * - Module slots used / max
 * - Cargo used / max
 * - Violation badges for any breaches (red affordances)
 */
import type { CapacityViolation, CargoViolation, MechCapacityResult } from '../../lib/rules/types'
import { cn } from '../../lib/utils'

type SlotBarProps = {
  label: string
  used: number
  max: number
  isOver: boolean
}

function SlotBar({ label, used, max, isOver }: SlotBarProps) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn('tabular-nums', isOver && 'text-red-500 font-semibold')}>
          {used}&nbsp;/&nbsp;{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

type ViolationBadgeProps = {
  'data-testid': string
  message: string
}

function ViolationBadge({ 'data-testid': testId, message }: ViolationBadgeProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700 border border-red-300"
    >
      {message}
    </div>
  )
}

type CapacityIndicatorProps = {
  capacity: MechCapacityResult
  cargoUsed: number
  cargoMax: number
  cargoViolations: CargoViolation[]
  className?: string
}

export function CapacityIndicator({
  capacity,
  cargoUsed,
  cargoMax,
  cargoViolations,
  className,
}: CapacityIndicatorProps) {
  const systemViolation = capacity.violations.find(
    (v): v is Extract<CapacityViolation, { kind: 'system-over-slots' }> =>
      v.kind === 'system-over-slots'
  )
  const moduleViolation = capacity.violations.find(
    (v): v is Extract<CapacityViolation, { kind: 'module-over-slots' }> =>
      v.kind === 'module-over-slots'
  )
  const chassisNotFound = capacity.violations.find((v) => v.kind === 'chassis-not-found')
  const cargoOverCapacity = cargoViolations.find(
    (v): v is Extract<CargoViolation, { kind: 'over-capacity' }> => v.kind === 'over-capacity'
  )

  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4 flex flex-col gap-3', className)}
      aria-label="Capacity indicator"
    >
      <h3 className="text-sm font-semibold">Capacity</h3>

      <SlotBar
        label="Systems"
        used={capacity.systemSlotsUsed}
        max={capacity.systemSlotsMax}
        isOver={!!systemViolation}
      />
      <SlotBar
        label="Modules"
        used={capacity.moduleSlotsUsed}
        max={capacity.moduleSlotsMax}
        isOver={!!moduleViolation}
      />
      <SlotBar label="Cargo" used={cargoUsed} max={cargoMax} isOver={!!cargoOverCapacity} />

      {/* Violation badges */}
      {chassisNotFound && (
        <ViolationBadge
          data-testid="violation-chassis-not-found"
          message={chassisNotFound.message}
        />
      )}
      {systemViolation && (
        <ViolationBadge
          data-testid="violation-system-over-slots"
          message={systemViolation.message}
        />
      )}
      {moduleViolation && (
        <ViolationBadge
          data-testid="violation-module-over-slots"
          message={moduleViolation.message}
        />
      )}
      {cargoOverCapacity && (
        <ViolationBadge
          data-testid="violation-cargo-over-capacity"
          message={cargoOverCapacity.message}
        />
      )}
    </div>
  )
}
