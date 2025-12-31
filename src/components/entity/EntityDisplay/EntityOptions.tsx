import { VStack } from '@chakra-ui/react'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { EntitySubheader } from './EntitySubheader'
import { useEntityDisplayContext } from './useEntityDisplayContext'

/**
 * EntityOptions component
 *
 * Note: Since EntityDisplay now only accepts SURefEntity (not SURefMetaAction),
 * and options only exist on SURefMetaAction, this component will never render.
 * It's kept for backward compatibility but will always return null.
 */
export function EntityOptions() {
  const { data, spacing, compact } = useEntityDisplayContext()

  if (!('options' in data)) return null

  const options = (data as { options?: Array<string | { label: string; value: string }> }).options

  if (!options || options.length === 0) return null

  return (
    <VStack
      p={spacing.contentPadding}
      gap={spacing.smallGap}
      alignItems="stretch"
      borderRadius="md"
    >
      <EntitySubheader label="Options" />
      <VStack gap={spacing.contentPadding} alignItems="stretch">
        {options.map((option, optIndex) => {
          const label = typeof option === 'string' ? '' : option.label
          const value = typeof option === 'string' ? option : option.value
          return <SheetDisplay compact={compact} key={optIndex} label={label} value={value} />
        })}
      </VStack>
    </VStack>
  )
}
