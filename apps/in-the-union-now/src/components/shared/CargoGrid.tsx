import { useState, useMemo, useCallback } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Plus } from 'lucide-react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, DisplayCard, CardHeader, Text } from 'suref-react'
import type { CellRenderInfo, CargoType } from '../../lib/cargoGridUtils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { ModalShell } from './ModalShell'

type CargoGridProps = {
  cells: CellRenderInfo[]
  columns: number
  readOnly?: boolean
  onDelete?: (cargoId: string, name: string) => void
  onEmptyClick?: () => void
}

/**
 * Converts a Tailwind bg class like 'bg-tl-3' to a CSS color value
 * for use in inline styles.
 */
function headerBgToColor(headerBg: string): string {
  return `var(--color-${headerBg.replace('bg-', '')})`
}

export function CargoGrid({ cells, columns, readOnly, onDelete, onEmptyClick }: CargoGridProps) {
  const [hoveredCargoId, setHoveredCargoId] = useState<string | null>(null)

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="mx-auto grid w-fit"
        style={{
          gridTemplateColumns: `repeat(${columns}, 200px)`,
          gap: 0,
        }}
      >
        {cells.map((cell) => (
          <CargoCell
            key={cell.index}
            cell={cell}
            readOnly={readOnly}
            onDelete={onDelete}
            onEmptyClick={onEmptyClick}
            isHovered={cell.cargoId !== null && cell.cargoId === hoveredCargoId}
            onHoverStart={setHoveredCargoId}
            onHoverEnd={() => setHoveredCargoId(null)}
          />
        ))}
      </div>
    </TooltipProvider>
  )
}

function CargoCell({
  cell,
  readOnly,
  onDelete,
  onEmptyClick,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  cell: CellRenderInfo
  readOnly?: boolean
  onDelete?: (cargoId: string, name: string) => void
  onEmptyClick?: () => void
  isHovered: boolean
  onHoverStart: (cargoId: string) => void
  onHoverEnd: () => void
}) {
  const {
    cargoId,
    borders,
    showLabel,
    showDelete,
    label,
    headerBg,
    cargoType,
    schemaName,
    schemaRefId,
  } = cell
  const isEmpty = !cargoId

  const [detailOpen, setDetailOpen] = useState(false)

  // Resolve entity for reference items
  const entity = useMemo(() => {
    if (cargoType !== 'entity' || !schemaName || !schemaRefId) return undefined
    return SalvageUnionReference.get(schemaName as EntitySchemaName, schemaRefId)
  }, [cargoType, schemaName, schemaRefId])

  const handleClick = useCallback(() => {
    if (!cargoId) return
    setDetailOpen(true)
  }, [cargoId])

  if (isEmpty) {
    return (
      <div
        role={onEmptyClick ? 'button' : undefined}
        tabIndex={onEmptyClick ? 0 : undefined}
        onClick={onEmptyClick}
        onKeyDown={
          onEmptyClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEmptyClick()
                }
              }
            : undefined
        }
        className={`flex h-[200px] w-[200px] items-center justify-center border border-dashed border-su-grey-light/50${
          onEmptyClick
            ? ' cursor-pointer text-su-grey-light/40 transition-all duration-150 hover:scale-110 hover:border-su-black/30 hover:text-su-black/40'
            : ''
        }`}
      >
        {onEmptyClick && <Plus className="h-8 w-8" />}
      </div>
    )
  }

  const bgColor = headerBg ? headerBgToColor(headerBg) : undefined

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="relative h-[200px] w-[200px] cursor-pointer overflow-visible transition-transform duration-150"
        style={{
          backgroundColor: bgColor,
          borderTopWidth: borders.top ? 2 : 1,
          borderTopStyle: borders.top ? 'solid' : 'dashed',
          borderTopColor: borders.top ? 'var(--color-su-black)' : 'rgba(0,0,0,0.2)',
          borderRightWidth: borders.right ? 2 : 1,
          borderRightStyle: borders.right ? 'solid' : 'dashed',
          borderRightColor: borders.right ? 'var(--color-su-black)' : 'rgba(0,0,0,0.2)',
          borderBottomWidth: borders.bottom ? 2 : 1,
          borderBottomStyle: borders.bottom ? 'solid' : 'dashed',
          borderBottomColor: borders.bottom ? 'var(--color-su-black)' : 'rgba(0,0,0,0.2)',
          borderLeftWidth: borders.left ? 2 : 1,
          borderLeftStyle: borders.left ? 'solid' : 'dashed',
          borderLeftColor: borders.left ? 'var(--color-su-black)' : 'rgba(0,0,0,0.2)',
          transform: isHovered ? 'scale(1.1)' : undefined,
          zIndex: isHovered ? 10 : undefined,
        }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        onMouseEnter={() => onHoverStart(cargoId)}
        onMouseLeave={onHoverEnd}
      >
        {showLabel && label && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute inset-0 flex items-center justify-center px-1">
                <span className="truncate text-center font-mono text-xs font-bold leading-tight text-su-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  {label}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="border-0 bg-su-black text-su-white text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        )}

        {showDelete && !readOnly && onDelete && cargoId && label && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(cargoId, label)
            }}
            className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-su-black/50 text-su-white transition-colors hover:bg-su-rust"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Detail modal */}
      {detailOpen && (
        <CargoDetailModal
          open={detailOpen}
          onOpenChange={setDetailOpen}
          entity={entity as SURefEntity | undefined}
          cargoType={cargoType}
          label={label}
          techLevel={cell.techLevel}
          headerBg={headerBg}
        />
      )}
    </>
  )
}

// --- Detail modals ---

function CargoDetailModal({
  open,
  onOpenChange,
  entity,
  cargoType,
  label,
  techLevel,
  headerBg,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: SURefEntity | undefined
  cargoType?: CargoType
  label?: string
  techLevel?: number | string
  headerBg?: string
}) {
  if (cargoType === 'entity' && entity) {
    return <EntityDetailModal open={open} onOpenChange={onOpenChange} entity={entity} />
  }

  return (
    <SimpleCargoDetailModal
      open={open}
      onOpenChange={onOpenChange}
      label={label ?? 'Cargo'}
      cargoType={cargoType}
      techLevel={techLevel}
      headerBg={headerBg}
    />
  )
}

function EntityDetailModal({
  open,
  onOpenChange,
  entity,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: SURefEntity
}) {
  if (!open) return null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full w-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-4xl outline-none">
              <DialogPrimitive.Title className="sr-only">
                {'name' in entity ? (entity.name as string) : 'Entity'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Cargo entity details
              </DialogPrimitive.Description>
              <ReferenceEntityDisplay data={entity} compact={false} />
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SimpleCargoDetailModal({
  open,
  onOpenChange,
  label,
  cargoType,
  techLevel,
  headerBg,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  cargoType?: CargoType
  techLevel?: number | string
  headerBg?: string
}) {
  // For scrap, parse count from label format "NTLx Scrap"
  const scrapCount = cargoType === 'scrap' ? parseInt(label, 10) || 1 : undefined
  const isScrap = cargoType === 'scrap'
  const modalTitle = isScrap ? 'SCRAP' : label
  const typeLabel = isScrap ? 'Scrap' : 'Custom Item'

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      description={`${typeLabel} details`}
      headerBg={headerBg ?? 'bg-su-orange'}
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-3 bg-su-white p-4">
        {isScrap ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-su-black">{scrapCount}x</span>
            <div className="w-fit">
              <DisplayCard
                compact
                listing
                headerBg={headerBg ?? 'bg-su-orange'}
                headerContent={
                  <CardHeader
                    title={
                      <Text
                        variant="pseudoheader"
                        as="span"
                        className="py-[3px] text-base uppercase tracking-[-0.02em]"
                        style={{ lineHeight: 1 }}
                      >
                        TL{techLevel} SCRAP
                      </Text>
                    }
                    compact
                    lightweight
                  />
                }
              />
            </div>
          </div>
        ) : (
          <>
            <DisplayCard
              compact
              listing
              headerBg={headerBg ?? 'bg-su-orange'}
              headerContent={
                <CardHeader
                  title={
                    <Text
                      variant="pseudoheader"
                      as="span"
                      className="truncate py-[3px] text-base uppercase tracking-[-0.02em]"
                      style={{ lineHeight: 1 }}
                    >
                      {label}
                    </Text>
                  }
                  compact
                  lightweight
                />
              }
            />
            <div className="flex items-center gap-2 text-sm text-su-black/70">
              <span className="font-mono text-xs font-bold uppercase">{typeLabel}</span>
              {techLevel !== undefined && <span className="font-mono text-xs">TL{techLevel}</span>}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
