import { HStack, VStack, IconButton } from '@chakra-ui/react'
import { useCallback, useMemo } from 'react'
import { StatDisplay } from './StatDisplay'

interface NumericStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  disableIncrement?: boolean
  flash?: boolean
  hoverText?: string
}

export default function NumericStepper({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled = false,
  disableIncrement = false,
  flash = false,
  hoverText,
}: NumericStepperProps) {
  const handleIncrement = useCallback(() => {
    onChange(value + step)
  }, [value, step, onChange])

  const handleDecrement = useCallback(() => {
    if (value > min) {
      onChange(Math.max(value - step, min))
    }
  }, [value, min, step, onChange])

  const labelId = useMemo(
    () => `stepper-label-${label.toLowerCase().replace(/\s+/g, '-')}`,
    [label]
  )

  const isOverMax = max !== undefined && value > max

  return (
    <HStack gap={0} alignItems="center" role="group" aria-labelledby={labelId}>
      <StatDisplay
        disabled={disabled}
        label={label}
        value={value}
        outOfMax={max}
        labelId={labelId}
        flash={flash}
        isOverMax={isOverMax}
        hoverText={hoverText}
      />
      <VStack h="full" justifyContent="center" gap={1} ml={-0.5}>
        <IconButton
          onClick={handleIncrement}
          disabled={disabled || disableIncrement}
          size="xs"
          w={5}
          h={5}
          minW={5}
          minH={5}
          pb="1"
          bg="su.white"
          color="su.black"
          fontSize="xs"
          fontWeight="bold"
          borderWidth="2px"
          borderRadius="none"
          borderColor="su.black"
          _hover={{ bg: 'bg.muted' }}
          _disabled={{
            opacity: 0.3,
            cursor: 'not-allowed',
            _hover: { bg: 'bg.input' },
          }}
          aria-label={`Increment ${label}`}
        >
          ▲
        </IconButton>
        <IconButton
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          size="xs"
          w={5}
          h={5}
          minW={5}
          minH={5}
          borderRadius="none"
          bg="su.white"
          color="fg.input"
          fontSize="xs"
          fontWeight="bold"
          borderWidth="2px"
          borderColor="su.black"
          _hover={{ bg: 'bg.muted' }}
          _disabled={{
            opacity: 0.3,
            cursor: 'not-allowed',
            _hover: { bg: 'bg.input' },
          }}
          aria-label={`Decrement ${label}`}
        >
          ▼
        </IconButton>
      </VStack>
    </HStack>
  )
}
