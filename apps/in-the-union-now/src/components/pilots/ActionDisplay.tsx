import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  DisplayCard,
  Text,
  ControlButtons,
  DataValueDisplayView,
  BlockContentRendererView,
  useDetailModal,
} from 'suref-react'
import { cn } from '../../lib/utils'
import type { ReferenceEntityControl } from 'suref-react'
import type { ActionCostType, ActionDisplayData } from '../../lib/pilotActionUtils'

type ActionDisplayProps = {
  data: ActionDisplayData
  controls?: ReferenceEntityControl[]
  disabled?: boolean
  footerMessage?: ReactNode
}

const DISABLED_PALE_BG = 'rgb(220, 220, 220)'
const DISABLED_BORDER = 'rgb(150, 150, 150)'

// Cost-type colors for border + header background
const COST_COLORS: Record<ActionCostType, { border: string; paleBg: string }> = {
  ap: {
    border: 'rgb(239, 137, 79)', // su-orange
    paleBg: 'color-mix(in srgb, rgb(239, 137, 79) 35%, white)',
  },
  ep: {
    border: 'rgb(122, 151, 138)', // su-green
    paleBg: 'color-mix(in srgb, rgb(122, 151, 138) 35%, white)',
  },
  variable: {
    border: 'rgb(239, 137, 79)', // fallback (gradient used in rendering)
    paleBg: '', // fallback (gradient used in rendering)
  },
  none: {
    border: 'rgb(206, 88, 152)', // su-pink
    paleBg: 'color-mix(in srgb, rgb(206, 88, 152) 35%, white)',
  },
}

// Diagonal gradient strings for variable cost type
const VARIABLE_BORDER_GRADIENT =
  'linear-gradient(135deg, rgb(239, 137, 79) 50%, rgb(122, 151, 138) 50%)'
const VARIABLE_PALE_GRADIENT =
  'linear-gradient(135deg, color-mix(in srgb, rgb(239, 137, 79) 35%, white) 50%, color-mix(in srgb, rgb(122, 151, 138) 35%, white) 50%)'

export function ActionDisplay({ data, controls, disabled, footerMessage }: ActionDisplayProps) {
  const isVariable = data.costType === 'variable'
  const colors = COST_COLORS[data.costType]
  const borderColor = disabled ? DISABLED_BORDER : colors.border
  const headerBg = disabled ? DISABLED_PALE_BG : colors.paleBg || undefined

  const cardContent = (
    <DisplayCard
      headerBg=""
      headerBgColor={headerBg}
      headerBgStyle={isVariable && !disabled ? { background: VARIABLE_PALE_GRADIENT } : undefined}
      borderColor={borderColor}
      mode="compact"
      headerContent={
        <div
          className={cn('flex w-full items-start justify-between gap-2', disabled && 'opacity-50')}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <Text variant="pseudoheader" as="span" className="text-base uppercase">
              {data.name}
            </Text>
            {data.dataValues.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {data.dataValues.map((dv, i) => (
                  <DataValueDisplayView key={`${dv.label}-${i}`} item={dv} compact />
                ))}
              </div>
            )}
          </div>
          {controls && controls.length > 0 && (
            <ControlButtons controls={controls} className="shrink-0" />
          )}
        </div>
      }
      footerContent={
        <div className="flex w-full items-center justify-between">
          {footerMessage ? (
            <span className="text-xs italic text-su-black">{footerMessage}</span>
          ) : (
            <span />
          )}
          <SourceEntityChip entity={data.sourceEntity} dimmed={disabled} />
        </div>
      }
    >
      {data.content && data.content.length > 0 && (
        <div className={cn(disabled && 'opacity-50')}>
          <BlockContentRendererView content={data.content} fontSize="text-xs" compact />
        </div>
      )}
    </DisplayCard>
  )

  // Variable cost type: use gradient background as border via padding trick
  if (isVariable && !disabled) {
    return (
      <div
        className="overflow-hidden rounded-md p-0.5"
        style={{ background: VARIABLE_BORDER_GRADIENT }}
      >
        <div className="overflow-hidden rounded-[calc(0.375rem-2px)]">{cardContent}</div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md" style={{ border: `2px solid ${borderColor}` }}>
      {cardContent}
    </div>
  )
}

function SourceEntityChip({ entity, dimmed }: { entity: SURefEntity; dimmed?: boolean }) {
  const { control, modal } = useDetailModal(entity)
  const name = 'name' in entity ? String(entity.name) : 'Source'

  return (
    <>
      <button
        type="button"
        onClick={control.onClick}
        className={cn(
          'cursor-pointer rounded-sm bg-su-black px-2 py-0.5 font-mono text-xs text-su-white transition-opacity hover:opacity-80',
          dimmed && 'opacity-40'
        )}
      >
        {name}{' '}
        <span aria-hidden="true" className="leading-none">
          &rarr;
        </span>
      </button>
      {modal}
    </>
  )
}
