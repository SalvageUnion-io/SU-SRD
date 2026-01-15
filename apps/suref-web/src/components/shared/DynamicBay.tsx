import { Box, Grid } from '@chakra-ui/react'
import { Text } from '../base/Text'
import { Button } from '@chakra-ui/react'
import { useMemo, useEffect } from 'react'
import { packCargoGrid } from '../../utils/cargoGridPacking'
import { techLevelColors } from '../../theme'
import { EntityDisplayTooltip } from '../entity/EntityDisplayTooltip'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import type { HydratedCargo } from '../../types/hydrated'
import { useUpdateCargo } from '../../hooks/cargo/useCargo'

interface DynamicBayProps {
  items: HydratedCargo[]
  maxCapacity: number
  onRemove?: (id: string) => void
  onAddClick?: (position: { row: number; col: number }) => void
  disabled?: boolean
  singleCellMode?: boolean
}

const previousGrids = new Map<string, ReturnType<typeof packCargoGrid>>()

/**
 * DynamicBay - A grid layout for displaying items that occupy connected regions
 * Each item appears as a single contained box regardless of its shape
 */
export function DynamicBay({
  items,
  maxCapacity,
  onRemove,
  onAddClick,
  disabled = false,
  singleCellMode = false,
}: DynamicBayProps) {
  const updateCargo = useUpdateCargo()

  const getCargoItemBgColor = (item: HydratedCargo): string => {
    if (!item.ref) return 'bg.input'

    const schemaName = item.schema_name

    if (schemaName === 'systems' || schemaName === 'modules') {
      if ('techLevel' in item.ref) {
        const techLevel = item.ref.techLevel as number
        return techLevelColors[techLevel] || 'bg.input'
      }
    }

    if (schemaName === 'chassis') {
      return 'su.darkGreen'
    }

    return 'bg.input'
  }

  const instanceKey = `${maxCapacity}`

  const { rows, cols, packedGrid, itemsMap, newPositions } = useMemo(() => {
    const packableItems = items.map((item) => {
      const metadata = item.metadata as { position?: { row: number; col: number } } | null
      return {
        id: item.id,
        amount: singleCellMode ? 1 : item.amount || 1,
        position: metadata?.position,
      }
    })

    const previousGrid = previousGrids.get(instanceKey)
    const packed = packCargoGrid(packableItems, maxCapacity, previousGrid)

    previousGrids.set(instanceKey, packed)

    const map = new Map(items.map((item) => [item.id, item]))

    const positions = new Map<string, { row: number; col: number }>()
    packed.cells.forEach((cell, index) => {
      if (cell.itemId && cell.isCenter) {
        const row = Math.floor(index / packed.cols)
        const col = index % packed.cols
        positions.set(cell.itemId, { row, col })
      }
    })

    return {
      rows: packed.rows,
      cols: packed.cols,
      packedGrid: packed.cells,
      itemsMap: map,
      newPositions: positions,
    }
  }, [items, maxCapacity, instanceKey, singleCellMode])

  useEffect(() => {
    if (items.length === 0 || disabled) return

    items.forEach((item) => {
      const newPosition = newPositions.get(item.id)

      const metadata = item.metadata as { position?: { row: number; col: number } } | null
      const oldPosition = metadata?.position

      if (
        newPosition &&
        (!oldPosition || newPosition.row !== oldPosition.row || newPosition.col !== oldPosition.col)
      ) {
        updateCargo.mutate({
          id: item.id,
          updates: { metadata: { position: newPosition } },
        })
      }
    })
  }, [items, newPositions, disabled, updateCargo])

  const isSameItem = (index1: number, index2: number): boolean => {
    if (index1 < 0 || index1 >= packedGrid.length) return false
    if (index2 < 0 || index2 >= packedGrid.length) return false
    const cell1 = packedGrid[index1]
    const cell2 = packedGrid[index2]
    if (!cell1?.itemId || !cell2?.itemId) return false
    return cell1.itemId === cell2.itemId
  }

  return (
    <Grid
      templateColumns={`repeat(${cols}, 1fr)`}
      templateRows={`repeat(${rows}, 1fr)`}
      gap={0}
      w="full"
      aspectRatio={`${cols} / ${rows}`}
      borderRadius="md"
      overflow="hidden"
    >
      {packedGrid.map((cell, index) => {
        const col = index % cols

        const topIndex = index - cols
        const bottomIndex = index + cols
        const leftIndex = col > 0 ? index - 1 : -1
        const rightIndex = col < cols - 1 ? index + 1 : -1

        if (!cell.itemId) {
          const isTopEdge = topIndex < 0
          const isBottomEdge = bottomIndex >= packedGrid.length
          const isLeftEdge = leftIndex < 0
          const isRightEdge = rightIndex < 0

          const topIsItem = !isTopEdge && packedGrid[topIndex]?.itemId !== null
          const bottomIsItem = !isBottomEdge && packedGrid[bottomIndex]?.itemId !== null
          const leftIsItem = !isLeftEdge && packedGrid[leftIndex]?.itemId !== null
          const rightIsItem = !isRightEdge && packedGrid[rightIndex]?.itemId !== null

          const topColor = isTopEdge || topIsItem ? 'black' : 'blackAlpha.300'
          const bottomColor = isBottomEdge || bottomIsItem ? 'black' : 'blackAlpha.300'
          const leftColor = isLeftEdge || leftIsItem ? 'black' : 'blackAlpha.300'
          const rightColor = isRightEdge || rightIsItem ? 'black' : 'blackAlpha.300'

          const row = Math.floor(index / cols)
          const col = index % cols

          return (
            <Box
              key={`empty-${index}`}
              borderWidth="2px"
              borderTopColor={topColor}
              borderBottomColor={bottomColor}
              borderLeftColor={leftColor}
              borderRightColor={rightColor}
              bg="transparent"
              borderStyle="dashed"
              display="flex"
              alignItems="center"
              justifyContent="center"
              h="100%"
              cursor={onAddClick && !disabled ? 'pointer' : 'default'}
              onClick={onAddClick && !disabled ? () => onAddClick({ row, col }) : undefined}
              _hover={
                onAddClick && !disabled
                  ? {
                      bg: 'blackAlpha.50',
                    }
                  : undefined
              }
            >
              {onAddClick && (
                <Text fontSize="2xl" color="blackAlpha.300" fontWeight="bold" userSelect="none">
                  +
                </Text>
              )}
            </Box>
          )
        }

        const showTopBorder = topIndex < 0 || !isSameItem(index, topIndex)
        const showBottomBorder = bottomIndex >= packedGrid.length || !isSameItem(index, bottomIndex)
        const showLeftBorder = leftIndex < 0 || !isSameItem(index, leftIndex)
        const showRightBorder = rightIndex < 0 || !isSameItem(index, rightIndex)

        const topLeftRounded = showTopBorder && showLeftBorder
        const topRightRounded = showTopBorder && showRightBorder
        const bottomLeftRounded = showBottomBorder && showLeftBorder
        const bottomRightRounded = showBottomBorder && showRightBorder

        const cargoItem = itemsMap.get(cell.itemId)
        if (!cargoItem) return null

        const handleRemoveClick = (e: React.MouseEvent) => {
          e.stopPropagation()
          onRemove?.(cargoItem.id)
        }

        const itemBgColor = getCargoItemBgColor(cargoItem)

        const schemaName = cargoItem.schema_name
        const entityId = cargoItem.schema_ref_id

        const boxContent = (
          <Box
            key={`item-${index}`}
            position="relative"
            bg={itemBgColor}
            borderTopWidth={showTopBorder ? '3px' : '0'}
            borderBottomWidth={showBottomBorder ? '3px' : '0'}
            borderLeftWidth={showLeftBorder ? '3px' : '0'}
            borderRightWidth={showRightBorder ? '3px' : '0'}
            borderColor="fg.input"
            borderTopLeftRadius={topLeftRounded ? 'lg' : '0'}
            borderTopRightRadius={topRightRounded ? 'lg' : '0'}
            borderBottomLeftRadius={bottomLeftRounded ? 'lg' : '0'}
            borderBottomRightRadius={bottomRightRounded ? 'lg' : '0'}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            h="100%"
            cursor={cargoItem.ref ? 'pointer' : 'default'}
            _hover={cargoItem.ref ? { opacity: 0.8 } : undefined}
          >
            {cell.isTopRight && onRemove && (
              <Button
                onClick={handleRemoveClick}
                position="absolute"
                top={1}
                right={1}
                bg="transparent"
                color="brand.srd"
                w={6}
                h={6}
                borderRadius="md"
                fontWeight="bold"
                _hover={{ bg: 'brand.srd', color: 'su.white' }}
                fontSize="sm"
                display="flex"
                alignItems="center"
                justifyContent="center"
                lineHeight="none"
                aria-label="Remove"
                minW={6}
                p={0}
                disabled={disabled}
                zIndex={1}
              >
                ✕
              </Button>
            )}
            {cell.isCenter && (
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                gap={0.5}
                px={1}
                pointerEvents="none"
                w="100%"
                textAlign="center"
                zIndex={1}
              >
                <Text
                  variant="pseudoheader"
                  fontSize={cargoItem.amount === 1 ? '10px' : 'sm'}
                  fontWeight="bold"
                  textAlign="center"
                  lineHeight="1.1"
                  maxW="100%"
                >
                  {cargoItem.name} ({cargoItem.amount})
                </Text>
              </Box>
            )}
          </Box>
        )

        return cargoItem.ref && schemaName && entityId ? (
          <EntityDisplayTooltip
            key={`item-${index}`}
            schemaName={schemaName as SURefEnumSchemaName}
            entityId={entityId}
            openDelay={300}
          >
            {boxContent}
          </EntityDisplayTooltip>
        ) : (
          boxContent
        )
      })}
    </Grid>
  )
}
