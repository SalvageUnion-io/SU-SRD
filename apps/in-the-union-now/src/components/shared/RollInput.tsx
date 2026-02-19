import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectTable } from 'salvageunion-reference'
import { RollTable } from 'suref-react'
import { Input } from '../ui/input'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip'

type RollInputProps = {
  value: string
  onChange: (value: string) => void
  onRoll: () => void
  onBlur?: () => void
  placeholder?: string
  /** Roll table name to look up from game data (shown in hover tooltip) */
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
  const rollTableEntity = rollTableName
    ? SalvageUnionReference.RollTables.find((rt) => rt.name === rollTableName)
    : null
  const table =
    rollTableEntity && 'table' in rollTableEntity
      ? (rollTableEntity.table as SURefObjectTable)
      : null

  return (
    <div className="flex">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="h-9 border-r-0 text-sm"
      />
      {rollTableName && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRoll}
                className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-none border border-su-black bg-su-black px-3 font-bold uppercase text-su-white transition-colors hover:bg-brand-srd"
                aria-label={`Roll on ${rollTableName} table`}
              >
                <span className="text-xs tracking-wider">ROLL</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="16"
                  viewBox="0 -960 960 960"
                  width="16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M240-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm480 0q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-600q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z" />
                </svg>
              </button>
            </TooltipTrigger>
            {table && (
              <TooltipContent
                side="bottom"
                sideOffset={4}
                className="z-50 max-h-[400px] w-[350px] overflow-y-auto rounded-md border bg-su-white p-0 shadow-lg"
              >
                <RollTable
                  table={table}
                  compact
                  tableName={rollTableEntity?.name}
                  onRollResult={(text) => onChange(text)}
                />
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
