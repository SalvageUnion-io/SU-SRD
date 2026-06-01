/**
 * ChassisSelector — picks a chassis from salvageunion-reference.
 *
 * Master-detail layout (design board-mech.jsx): a scannable list of chassis
 * rows on the left (lightweight `.pick`/OptRow style — NOT entity cards), with
 * the selected chassis's full entity card in the detail pane on the right.
 *
 * Callers must ensure preload(['chassis']) has resolved before rendering
 * (Chassis data is read synchronously from the pre-loaded model).
 */
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import { cn } from '../../lib/utils'

type ChassisSelectorProps = {
  selectedChassis: string | null
  onSelect: (chassisName: string) => void
  className?: string
}

type ChassisLike = { id: string; name: string }

function ChassisRow({
  name,
  active,
  onSelect,
}: {
  name: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'flex cursor-pointer items-center justify-between rounded-[3px] border-[1.5px] border-su-black px-3 py-2.5 transition-shadow',
        active
          ? 'bg-white shadow-[inset_3px_0_0_var(--color-su-orange-dark)]'
          : 'bg-transparent hover:bg-white/60'
      )}
    >
      <span className="font-cond text-lg font-bold uppercase leading-none tracking-[0.02em] text-su-black">
        {name}
      </span>
      {active && (
        <span aria-label={`Selected ${name}`} className="font-cond font-bold text-su-orange-dark">
          ▸
        </span>
      )}
    </div>
  )
}

export function ChassisSelector({ selectedChassis, onSelect, className }: ChassisSelectorProps) {
  const allChassis = SalvageUnionReference.Chassis.all() as ChassisLike[]
  const selected = allChassis.find((c) => c.name === selectedChassis)

  return (
    <fieldset className={cn('w-full', className)}>
      <legend className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.08em] text-su-grey-dark">
        Chassis
      </legend>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Master — chassis list */}
        <div className="flex flex-col gap-2">
          {allChassis.map((chassis) => (
            <ChassisRow
              key={chassis.id}
              name={chassis.name}
              active={chassis.name === selectedChassis}
              onSelect={() => onSelect(chassis.name)}
            />
          ))}
        </div>

        {/* Detail — selected chassis card */}
        <div className="min-w-0">
          {selected ? (
            <ReferenceEntityDisplay data={selected as unknown as SURefEntity} />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-md border-[1.5px] border-dashed border-su-grey-light p-6 text-center text-sm text-su-grey-dark">
              Select a chassis to preview its stats.
            </div>
          )}
        </div>
      </div>
    </fieldset>
  )
}
