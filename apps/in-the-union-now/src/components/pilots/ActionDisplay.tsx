import { useCallback, useRef, useState, type ReactNode } from 'react'
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
import type { ActionDisplayData, ActionSource } from '../../lib/pilotActionUtils'
import { ComradeDetailModal } from '../shared/ComradeDetailModal'
import type { EntityRefRow } from '../../types/common'

type ActionDisplayProps = {
  data: ActionDisplayData
  controls?: ReferenceEntityControl[]
  disabled?: boolean
  footerMessage?: ReactNode
  mechId?: string
  mechRefs?: EntityRefRow[]
}

const DISABLED_PALE_BG = 'rgb(220, 220, 220)'
const DISABLED_BORDER = 'rgb(150, 150, 150)'

// Source-based colors: border color from source (pilot/mech/general), bg from source + comrade
type SourceColorKey = 'pilot' | 'mech' | 'comrade-pilot' | 'comrade-mech' | 'general'

const SOURCE_COLORS: Record<SourceColorKey, { border: string; paleBg: string }> = {
  pilot: {
    border: 'rgb(239, 137, 79)', // su-orange
    paleBg: 'color-mix(in srgb, rgb(239, 137, 79) 35%, white)',
  },
  mech: {
    border: 'rgb(122, 151, 138)', // su-green
    paleBg: 'color-mix(in srgb, rgb(122, 151, 138) 45%, white)',
  },
  'comrade-pilot': {
    border: 'rgb(239, 137, 79)', // su-orange
    paleBg: 'color-mix(in srgb, rgb(140, 75, 56) 35%, white)', // su-rust
  },
  'comrade-mech': {
    border: 'rgb(122, 151, 138)', // su-green
    paleBg: 'color-mix(in srgb, rgb(140, 75, 56) 35%, white)', // su-rust
  },
  general: {
    border: 'rgb(206, 88, 152)', // su-pink
    paleBg: 'color-mix(in srgb, rgb(206, 88, 152) 35%, white)',
  },
}

function getSourceColorKey(source: ActionSource, isComrade: boolean): SourceColorKey {
  if (source === 'general') return 'general'
  if (isComrade) return source === 'pilot' ? 'comrade-pilot' : 'comrade-mech'
  return source
}

export function ActionDisplay({
  data,
  controls,
  disabled,
  footerMessage,
  mechId,
  mechRefs,
}: ActionDisplayProps) {
  const [comradeOpen, setComradeOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const colorKey = getSourceColorKey(data.source, data.isComrade)
  const colors = SOURCE_COLORS[colorKey]
  const borderColor = disabled ? DISABLED_BORDER : colors.border
  const headerBg = disabled ? DISABLED_PALE_BG : colors.paleBg

  const hasExpandableContent =
    (data.content && data.content.length > 0) || !!footerMessage || data.condition === 'damaged'

  const onMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setIsHovered(true), 100)
  }, [])

  const onMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setIsHovered(false)
  }, [])

  const headerContentNode = (
    <div className={cn('flex w-full items-center justify-between gap-2', disabled && 'opacity-50')}>
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
  )

  const footerContentNode = (
    <div className="flex w-full items-center justify-between">
      {footerMessage ? (
        <span className="text-xs italic text-su-black">{footerMessage}</span>
      ) : data.condition === 'damaged' ? (
        <span className="font-mono text-xs font-bold uppercase text-su-orange">Damaged</span>
      ) : (
        <span />
      )}
      <SourceEntityChip
        entity={data.sourceEntity}
        dimmed={disabled}
        labelOverride={
          data.sourceLabelOverride ?? (data.source === 'general' ? 'Generic Action' : undefined)
        }
        onComradeClick={data.comradeEntity ? () => setComradeOpen(true) : undefined}
      />
    </div>
  )

  const bodyContentNode =
    data.content && data.content.length > 0 ? (
      <div className={cn(disabled && 'opacity-50')}>
        <BlockContentRendererView content={data.content} fontSize="text-xs" compact />
      </div>
    ) : null

  return (
    <>
      <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        {/* In-flow listing card (determines grid cell height) */}
        <div className="overflow-hidden rounded-md" style={{ border: `2px solid ${borderColor}` }}>
          <DisplayCard
            headerBg=""
            headerBgColor={headerBg}
            borderColor={borderColor}
            compact
            listing
            headerContent={headerContentNode}
          />
        </div>

        {/* Hover overlay (absolute, floats above grid) */}
        {isHovered && hasExpandableContent && (
          <div
            className="absolute left-0 top-0 z-50 w-full"
            style={{ animation: 'action-expand-in 150ms ease-out forwards' }}
          >
            <div
              className="overflow-hidden rounded-md shadow-xl"
              style={{ border: `2px solid ${borderColor}` }}
            >
              <DisplayCard
                headerBg=""
                headerBgColor={headerBg}
                borderColor={borderColor}
                compact
                headerContent={headerContentNode}
                footerContent={footerContentNode}
              >
                {bodyContentNode}
              </DisplayCard>
            </div>
          </div>
        )}
      </div>

      {data.comradeEntity && (
        <ComradeDetailModal
          open={comradeOpen}
          onOpenChange={setComradeOpen}
          comradeEntity={data.comradeEntity}
          mechId={mechId}
          mechRefs={mechRefs}
        />
      )}
    </>
  )
}

function SourceEntityChip({
  entity,
  dimmed,
  labelOverride,
  onComradeClick,
}: {
  entity: SURefEntity
  dimmed?: boolean
  labelOverride?: string
  onComradeClick?: () => void
}) {
  const { control, modal } = useDetailModal(entity)
  const name = labelOverride ?? ('name' in entity ? String(entity.name) : 'Source')

  return (
    <>
      <button
        type="button"
        onClick={onComradeClick ?? control.onClick}
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
      {!onComradeClick && modal}
    </>
  )
}
