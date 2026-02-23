import { useState, useCallback, useMemo } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectTable } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'

function rollOnTable(table: SURefObjectTable): string {
  const keys = Object.keys(table).filter((k) => k !== 'type')
  const key = keys[Math.floor(Math.random() * keys.length)]!
  const entry = (table as Record<string, unknown>)[key]
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object' && 'value' in entry)
    return String((entry as { value: string }).value)
  return ''
}

type RollButtonsProps = {
  rollTableName: string
  onChange: (value: string) => void
  compact?: boolean
}

/**
 * Renders ROLL + SEE TABLE buttons styled as pseudoheader chips,
 * intended for use in the LabeledInput rightHeaderContent slot.
 */
export function RollButtons({ rollTableName, onChange, compact }: RollButtonsProps) {
  const [showTable, setShowTable] = useState(false)

  const rollTableEntity = useMemo(
    () => SalvageUnionReference.RollTables.find((rt) => rt.name === rollTableName),
    [rollTableName]
  )
  const table = useMemo(
    () =>
      rollTableEntity && 'table' in rollTableEntity
        ? (rollTableEntity.table as SURefObjectTable)
        : null,
    [rollTableEntity]
  )

  const handleRoll = useCallback(() => {
    if (!table) return
    onChange(rollOnTable(table))
  }, [table, onChange])

  const btnSize = compact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0'

  return (
    <>
      <div className="mr-3 flex items-end gap-1">
        <button
          type="button"
          onClick={handleRoll}
          className={cn(
            'flex cursor-pointer items-center gap-1 border border-su-black bg-su-black font-mono font-bold uppercase leading-tight text-su-white transition-colors hover:bg-brand-srd',
            btnSize
          )}
          aria-label={`Roll on ${rollTableName} table`}
        >
          <span>Roll</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="12"
            viewBox="0 -960 960 960"
            width="12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
          </svg>
        </button>
        {rollTableEntity && (
          <button
            type="button"
            onClick={() => setShowTable(true)}
            className={cn(
              'cursor-pointer border border-su-black bg-su-white font-mono font-bold uppercase leading-tight text-su-black transition-colors hover:bg-su-grey-light',
              btnSize
            )}
            aria-label={`View ${rollTableName} table`}
          >
            See Table
          </button>
        )}
      </div>

      {showTable && rollTableEntity && (
        <Dialog.Root open={showTable} onOpenChange={setShowTable}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
            <Dialog.Popup className="fixed inset-0 z-50 mx-auto mt-8 mb-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-4xl overflow-y-auto bg-transparent outline-none">
              <Dialog.Title className="sr-only">{rollTableName}</Dialog.Title>
              <Dialog.Description className="sr-only">Roll table details</Dialog.Description>
              <ReferenceEntityDisplay data={rollTableEntity} compact={false} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  )
}

/**
 * Combined input + roll buttons for use in guide wizards.
 * Renders a plain input with RollButtons-style actions above it.
 */
type RollInputProps = {
  value: string
  onChange: (value: string) => void
  onRoll: () => void
  onBlur?: () => void
  placeholder?: string
  rollTableName?: string
}

export function RollInput({
  value,
  onChange,
  onRoll,
  onBlur,
  placeholder,
  rollTableName,
}: RollInputProps) {
  const [showTable, setShowTable] = useState(false)

  const rollTableEntity = useMemo(
    () =>
      rollTableName
        ? SalvageUnionReference.RollTables.find((rt) => rt.name === rollTableName)
        : null,
    [rollTableName]
  )

  const btnSize = 'text-xs px-2 py-0'

  return (
    <div className="relative flex flex-col">
      {rollTableName && (
        <div className="z-[1] -mb-2.5 flex h-5 justify-end">
          <div className="mr-3 flex items-end gap-1">
            <button
              type="button"
              onClick={onRoll}
              className={cn(
                'flex cursor-pointer items-center gap-1 border border-su-black bg-su-black font-mono font-bold uppercase leading-tight text-su-white transition-colors hover:bg-brand-srd',
                btnSize
              )}
              aria-label={`Roll on ${rollTableName} table`}
            >
              <span>Roll</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="12"
                viewBox="0 -960 960 960"
                width="12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
              </svg>
            </button>
            {rollTableEntity && (
              <button
                type="button"
                onClick={() => setShowTable(true)}
                className={cn(
                  'cursor-pointer border border-su-black bg-su-white font-mono font-bold uppercase leading-tight text-su-black transition-colors hover:bg-su-grey-light',
                  btnSize
                )}
                aria-label={`View ${rollTableName} table`}
              >
                See Table
              </button>
            )}
          </div>
        </div>
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-10 text-base"
      />
      {showTable && rollTableEntity && (
        <Dialog.Root open={showTable} onOpenChange={setShowTable}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
            <Dialog.Popup className="fixed inset-0 z-50 mx-auto mt-8 mb-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-4xl overflow-y-auto bg-transparent outline-none">
              <Dialog.Title className="sr-only">{rollTableName}</Dialog.Title>
              <Dialog.Description className="sr-only">Roll table details</Dialog.Description>
              <ReferenceEntityDisplay data={rollTableEntity} compact={false} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
