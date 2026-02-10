import { HStack } from '@chakra-ui/react'
import { ControlBarContainer } from './ControlBarContainer'
import { ActiveToggle } from './ActiveToggle'
import { PrivateToggle } from './PrivateToggle'
import type { Database } from '../../types/database-generated.types'

type TableName = keyof Database['public']['Tables']

export interface ControlBarConfig {
  table: TableName
  selectFields: string
  nameField: string
  label: string
  backgroundColor: string
  linkLabel: string
  linkPath: (id: string) => string
}

interface LiveSheetControlBarProps {
  bg?: string
  hasPendingChanges?: boolean
  active?: boolean
  onActiveChange?: (active: boolean) => void
  isPrivate?: boolean
  onPrivateChange?: (isPrivate: boolean) => void
  disabled?: boolean
}

export function LiveSheetControlBar({
  bg = 'su.white',
  hasPendingChanges = false,
  active,
  onActiveChange,
  isPrivate,
  onPrivateChange,
  disabled = false,
}: LiveSheetControlBarProps) {
  return (
    <ControlBarContainer
      backgroundColor={bg}
      hasPendingChanges={hasPendingChanges}
      leftContent={
        <HStack gap={4}>
          {active !== undefined && onActiveChange && (
            <ActiveToggle active={active} onChange={onActiveChange} disabled={disabled} />
          )}
          {isPrivate !== undefined && onPrivateChange && (
            <PrivateToggle isPrivate={isPrivate} onChange={onPrivateChange} disabled={disabled} />
          )}
        </HStack>
      }
    />
  )
}
