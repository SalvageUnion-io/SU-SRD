import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  DisplayCard,
  Text,
  DataValueDisplayView,
  BlockContentRendererView,
  useDetailModal,
  cn,
} from 'suref-react'
import type { EntityControl, EntityControlVariant } from 'suref-react'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'

const VARIANT_STYLES: Record<EntityControlVariant, string> = {
  primary: 'bg-su-black text-su-white hover:bg-su-grey-dark',
  danger: 'opacity-60 hover:bg-su-rust/80 hover:opacity-100',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

type ActionDisplayProps = {
  data: ActionDisplayData
  controls?: EntityControl[]
  disabled?: boolean
  footerMessage?: ReactNode
}

const DISABLED_PALE_BG = 'rgb(220, 220, 220)'
const DISABLED_BORDER = 'rgb(150, 150, 150)'

export function ActionDisplay({ data, controls, disabled, footerMessage }: ActionDisplayProps) {
  return (
    <div
      className="overflow-hidden rounded-md"
      style={{ border: `2px solid ${disabled ? DISABLED_BORDER : data.borderColor}` }}
    >
      <DisplayCard
        headerBg=""
        headerBgColor={disabled ? DISABLED_PALE_BG : data.paleBackgroundColor}
        mode="compact"
        headerContent={
          <div
            className={cn(
              'flex w-full items-start justify-between gap-2',
              disabled && 'opacity-50'
            )}
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
              <div className="flex shrink-0 gap-1">
                {controls.map((control) => {
                  const variant = control.variant ?? 'ghost'
                  const Icon = control.icon
                  return (
                    <button
                      key={control.key}
                      type="button"
                      className={cn(
                        'flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center gap-1 rounded p-1 transition-colors',
                        VARIANT_STYLES[variant],
                        control.className
                      )}
                      title={control.ariaLabel}
                      aria-label={control.ariaLabel}
                      onClick={(e) => {
                        e.stopPropagation()
                        control.onClick()
                      }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      {control.label && (
                        <span className="font-mono text-xs font-bold uppercase leading-none">
                          {control.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
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
            <BlockContentRendererView
              content={data.content}
              fontSize="text-xs"
              compact
              damaged={false}
            />
          </div>
        )}
      </DisplayCard>
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
