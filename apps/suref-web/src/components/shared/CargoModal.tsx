import { useCallback } from 'react'
import { Box, Button, Flex, Input, Text, VStack } from '@chakra-ui/react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import Modal from '../Modal'
import { EntitySelectionModal } from '../entity/EntitySelectionModal'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

interface CargoModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (
    amount: number,
    description: string,
    color: string,
    ref?: string,
    position?: { row: number; col: number }
  ) => void
  maxCargo?: number
  currentCargo?: number
  backgroundColor?: string
  position?: { row: number; col: number } | null
}

export function CargoModal({
  isOpen,
  onClose,
  onAdd,
  maxCargo,
  currentCargo = 0,
  backgroundColor,
  position,
}: CargoModalProps) {
  const hasCargoTracking = maxCargo !== undefined
  const availableCargo = hasCargoTracking ? maxCargo - currentCargo : 0

  const amountValidator = hasCargoTracking
    ? z
        .number()
        .min(1, 'Amount must be at least 1')
        .max(availableCargo, `Amount cannot exceed ${availableCargo}`)
    : z.number()

  const descriptionValidator = z.string().min(1, 'Description is required')

  const form = useForm({
    defaultValues: {
      amount: 0,
      description: '',
      isEntitySelectorOpen: false,
    },
    onSubmit: async ({ value }) => {
      onAdd(
        hasCargoTracking ? value.amount : 1,
        value.description,
        '',
        undefined,
        position ?? undefined
      )
      form.reset()
      onClose()
    },
  })

  const shouldDisableEntity = useCallback(
    (entity: SURefEntity): boolean => {
      if (!hasCargoTracking) return false

      let salvageValue: number | undefined

      if ('stats' in entity && typeof entity.stats === 'object' && entity.stats) {
        const stats = entity.stats as { salvageValue?: number }
        if ('salvageValue' in stats) {
          salvageValue = stats.salvageValue
        }
      }

      if (salvageValue === undefined && 'salvageValue' in entity) {
        salvageValue = entity.salvageValue as number
      }

      if (salvageValue === undefined) return false
      return salvageValue > availableCargo
    },
    [hasCargoTracking, availableCargo]
  )

  const handleEntitySelect = (entityId: string, schemaName: SURefEnumSchemaName) => {
    const entity = SalvageUnionReference.get(schemaName, entityId)
    if (entity && 'name' in entity) {
      const entityName = entity.name as string

      let salvageValue = 1
      if ('stats' in entity && typeof entity.stats === 'object' && entity.stats) {
        const stats = entity.stats as { salvageValue?: number }
        if ('salvageValue' in stats) {
          salvageValue = stats.salvageValue || 1
        }
      }
      if (salvageValue === 1 && 'salvageValue' in entity) {
        salvageValue = (entity.salvageValue as number) || 1
      }

      const ref = SalvageUnionReference.composeRef(schemaName, entityId)

      onAdd(salvageValue, entityName, '', ref, position ?? undefined)
      form.setFieldValue('isEntitySelectorOpen', false)
      form.reset()
      onClose()
    }
  }

  const handleClose = () => {
    form.reset()
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen && !form.state.values.isEntitySelectorOpen}
        onClose={handleClose}
        title="Add Cargo"
        backgroundColor={backgroundColor}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <VStack direction="column" gap={3} alignItems="stretch">
            {hasCargoTracking && (
              <Button
                type="button"
                onClick={() => form.setFieldValue('isEntitySelectorOpen', true)}
                w="full"
                bg="su.black"
                color="su.white"
                px={4}
                py={3}
                borderRadius="md"
                fontWeight="bold"
                textTransform="uppercase"
                fontSize="sm"
                _hover={{ bg: 'brand.srd' }}
              >
                Select System, Module, or Chassis
              </Button>
            )}

            {hasCargoTracking ? (
              <Flex gap={2} alignItems="flex-end">
                <form.Field
                  name="amount"
                  validators={{
                    onChange: ({ value }) => {
                      const result = amountValidator.safeParse(value)
                      if (!result.success) {
                        return result.error.issues[0]?.message || 'Invalid amount'
                      }
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <Box w="24">
                      <Text
                        as="label"
                        display="block"
                        fontSize="xs"
                        fontWeight="bold"
                        color="su.inputBg"
                        mb={1}
                      >
                        Amount
                      </Text>
                      <Input
                        type="number"
                        min="0"
                        max={availableCargo}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(
                            Math.max(0, Math.min(availableCargo, parseInt(e.target.value) || 0))
                          )
                        }
                        w="full"
                        p={1.5}
                        borderWidth={0}
                        borderRadius="md"
                        bg="su.inputBg"
                        color="su.inputText"
                        fontWeight="semibold"
                        textAlign="center"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {String(field.state.meta.errors[0])}
                        </Text>
                      )}
                    </Box>
                  )}
                </form.Field>
                <form.Field
                  name="description"
                  validators={{
                    onChange: ({ value }) => {
                      const result = descriptionValidator.safeParse(value)
                      if (!result.success) {
                        return result.error.issues[0]?.message || 'Invalid description'
                      }
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <Box flex="1">
                      <Text
                        as="label"
                        display="block"
                        fontSize="xs"
                        fontWeight="bold"
                        color="su.inputBg"
                        mb={1}
                      >
                        Description (Available: {availableCargo})
                      </Text>
                      <Input
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter cargo description..."
                        w="full"
                        p={1.5}
                        borderWidth={0}
                        borderRadius="md"
                        bg="su.inputBg"
                        color="su.inputText"
                        fontWeight="semibold"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <Text color="red.500" fontSize="xs" mt={1}>
                          {String(field.state.meta.errors[0])}
                        </Text>
                      )}
                    </Box>
                  )}
                </form.Field>
              </Flex>
            ) : (
              <form.Field
                name="description"
                validators={{
                  onChange: ({ value }) => {
                    const result = descriptionValidator.safeParse(value)
                    if (!result.success) {
                      return result.error.issues[0]?.message || 'Invalid description'
                    }
                    return undefined
                  },
                }}
              >
                {(field) => (
                  <Box>
                    <Text
                      as="label"
                      display="block"
                      fontSize="xs"
                      fontWeight="bold"
                      color="su.inputBg"
                      mb={1}
                    >
                      Description
                    </Text>
                    <Input
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter cargo description..."
                      w="full"
                      p={1.5}
                      borderWidth={0}
                      borderRadius="md"
                      bg="su.inputBg"
                      color="su.inputText"
                      fontWeight="semibold"
                    />
                    {field.state.meta.errors.length > 0 && (
                      <Text color="red.500" fontSize="xs" mt={1}>
                        {String(field.state.meta.errors[0])}
                      </Text>
                    )}
                  </Box>
                )}
              </form.Field>
            )}

            <Flex gap={2} justifyContent="flex-end" pt={1}>
              <Button
                type="button"
                onClick={handleClose}
                bg="brand.srd"
                color="su.white"
                px={3}
                py={1.5}
                borderRadius="md"
                fontWeight="bold"
                _hover={{ bg: 'su.black' }}
                fontSize="sm"
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    bg="su.orange"
                    color="su.white"
                    px={3}
                    py={1.5}
                    borderRadius="md"
                    fontWeight="bold"
                    _hover={{ bg: 'su.lightOrange' }}
                    _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                    fontSize="sm"
                  >
                    {isSubmitting ? 'Adding...' : hasCargoTracking ? 'Add Cargo' : 'Add'}
                  </Button>
                )}
              </form.Subscribe>
            </Flex>
          </VStack>
        </form>
      </Modal>

      <EntitySelectionModal
        isOpen={form.state.values.isEntitySelectorOpen}
        onClose={() => form.setFieldValue('isEntitySelectorOpen', false)}
        schemaNames={['systems', 'modules', 'chassis']}
        onSelect={handleEntitySelect}
        title="Select System, Module, or Chassis"
        selectButtonTextPrefix="Add"
        shouldDisableEntity={shouldDisableEntity}
      />
    </>
  )
}
