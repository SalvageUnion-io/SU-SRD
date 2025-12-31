import { useState, useMemo } from 'react'
import {
  Button,
  Flex,
  Text,
  VStack,
  NativeSelectRoot,
  NativeSelectField,
  Input,
} from '@chakra-ui/react'
import Modal from '../Modal'

interface ScrapConversionModalProps {
  isOpen: boolean
  onClose: () => void
  scrapTlOne: number
  scrapTlTwo: number
  scrapTlThree: number
  scrapTlFour: number
  scrapTlFive: number
  scrapTlSix: number
  onConvert: (updates: {
    scrap_tl_one?: number
    scrap_tl_two?: number
    scrap_tl_three?: number
    scrap_tl_four?: number
    scrap_tl_five?: number
    scrap_tl_six?: number
  }) => void
}

type TechLevel = 1 | 2 | 3 | 4 | 5 | 6

export function ScrapConversionModal({
  isOpen,
  onClose,
  scrapTlOne,
  scrapTlTwo,
  scrapTlThree,
  scrapTlFour,
  scrapTlFive,
  scrapTlSix,
  onConvert,
}: ScrapConversionModalProps) {
  const [fromTL, setFromTL] = useState<TechLevel | null>(null)
  const [toTL, setToTL] = useState<TechLevel | null>(null)
  const [amount, setAmount] = useState<number>(1)

  const scrapByTL: Record<TechLevel, number> = useMemo(
    () => ({
      1: scrapTlOne,
      2: scrapTlTwo,
      3: scrapTlThree,
      4: scrapTlFour,
      5: scrapTlFive,
      6: scrapTlSix,
    }),
    [scrapTlOne, scrapTlTwo, scrapTlThree, scrapTlFour, scrapTlFive, scrapTlSix]
  )

  const availableFromTLs = useMemo(() => {
    return ([1, 2, 3, 4, 5, 6] as TechLevel[]).filter((tl) => scrapByTL[tl] > 0)
  }, [scrapByTL])

  const availableToTLs = useMemo(() => {
    if (!fromTL) return []

    const fromScrapCount = scrapByTL[fromTL]
    const fromValueInTL1 = fromScrapCount * fromTL

    return ([1, 2, 3, 4, 5, 6] as TechLevel[]).filter((tl) => {
      if (tl === fromTL) return false
      return fromValueInTL1 >= tl
    })
  }, [fromTL, scrapByTL])

  const maxAmount = useMemo(() => {
    if (!fromTL) return 0
    return scrapByTL[fromTL]
  }, [fromTL, scrapByTL])

  const conversionResult = useMemo(() => {
    if (!fromTL || !toTL || amount <= 0) return null

    const fromValueInTL1 = amount * fromTL

    const toScrapCount = Math.floor(fromValueInTL1 / toTL)

    const remainderInTL1 = fromValueInTL1 % toTL

    return {
      fromScrapCount: amount,
      toScrapCount,
      remainderInTL1,
    }
  }, [fromTL, toTL, amount])

  const handleConvert = () => {
    if (!fromTL || !toTL || !conversionResult || amount <= 0) return

    const updates: Record<string, number> = {}

    const currentFromScrap = scrapByTL[fromTL]
    updates[`scrap_tl_${getTLFieldName(fromTL)}`] = currentFromScrap - amount

    const currentToScrap = scrapByTL[toTL]
    updates[`scrap_tl_${getTLFieldName(toTL)}`] = currentToScrap + conversionResult.toScrapCount

    if (conversionResult.remainderInTL1 > 0) {
      const currentTL1 = scrapByTL[1]
      updates[`scrap_tl_one`] = currentTL1 + conversionResult.remainderInTL1
    }

    onConvert(updates)
    handleClose()
  }

  const handleClose = () => {
    setFromTL(null)
    setToTL(null)
    setAmount(1)
    onClose()
  }

  const getTLFieldName = (tl: TechLevel): string => {
    const names = ['one', 'two', 'three', 'four', 'five', 'six']
    return names[tl - 1] ?? 'unknown'
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Convert Scrap">
      <Flex gap={6} align="stretch" w="full">
        <VStack gap={2} align="stretch" w="full">
          <Text fontWeight="bold" fontFamily="mono">
            FROM Tech Level
          </Text>
          <NativeSelectRoot>
            <NativeSelectField
              value={fromTL?.toString() ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setFromTL(value ? (parseInt(value) as TechLevel) : null)
                setToTL(null)
                setAmount(1)
              }}
            >
              <option value="">Select tech level...</option>
              {([1, 2, 3, 4, 5, 6] as TechLevel[]).map((tl) => {
                const scrapCount = scrapByTL[tl]
                const isAvailable = availableFromTLs.includes(tl)
                return (
                  <option key={tl} value={tl} disabled={!isAvailable}>
                    TL{tl} ({scrapCount} scrap)
                  </option>
                )
              })}
            </NativeSelectField>
          </NativeSelectRoot>

          {fromTL && (
            <>
              <Text fontWeight="bold" fontFamily="mono" mt={2}>
                Amount
              </Text>
              <Input
                type="number"
                min={1}
                max={maxAmount}
                value={amount}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1 && val <= maxAmount) {
                    setAmount(val)
                  }
                }}
                fontFamily="mono"
                textAlign="center"
              />
              <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                Max: {maxAmount}
              </Text>
            </>
          )}
        </VStack>

        <VStack gap={2} align="stretch" w="full">
          <Text fontWeight="bold" fontFamily="mono">
            TO Tech Level
          </Text>
          <NativeSelectRoot disabled={!fromTL}>
            <NativeSelectField
              value={toTL?.toString() ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setToTL(value ? (parseInt(value) as TechLevel) : null)
              }}
            >
              <option value="">Select tech level...</option>
              {([1, 2, 3, 4, 5, 6] as TechLevel[]).map((tl) => {
                const isAvailable = availableToTLs.includes(tl)
                return (
                  <option key={tl} value={tl} disabled={!isAvailable}>
                    TL{tl}
                  </option>
                )
              })}
            </NativeSelectField>
          </NativeSelectRoot>
        </VStack>

        {conversionResult && (
          <VStack gap={2} align="stretch" p={4} bg="bg.muted" borderRadius="md" borderWidth="2px">
            <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
              Conversion Preview:
            </Text>
            <Flex justify="space-between">
              <Text fontFamily="mono" fontSize="sm">
                Convert:
              </Text>
              <Text fontFamily="mono" fontSize="sm" fontWeight="bold">
                {conversionResult.fromScrapCount} × TL{fromTL}
              </Text>
            </Flex>
            <Flex justify="space-between">
              <Text fontFamily="mono" fontSize="sm">
                Receive:
              </Text>
              <Text fontFamily="mono" fontSize="sm" fontWeight="bold">
                {conversionResult.toScrapCount} × TL{toTL}
              </Text>
            </Flex>
            {conversionResult.remainderInTL1 > 0 && (
              <Flex justify="space-between">
                <Text fontFamily="mono" fontSize="sm">
                  Remainder:
                </Text>
                <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="orange.500">
                  {conversionResult.remainderInTL1} × TL1
                </Text>
              </Flex>
            )}
          </VStack>
        )}
      </Flex>
      <Flex gap={2} justifyContent="flex-end" pt={4}>
        <Button
          onClick={handleClose}
          bg="brand.srd"
          color="su.white"
          px={4}
          py={2}
          fontWeight="bold"
          _hover={{ opacity: 0.9 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConvert}
          disabled={!fromTL || !toTL}
          bg="su.green"
          color="su.black"
          px={4}
          py={2}
          fontWeight="bold"
          _hover={{ opacity: 0.9 }}
          _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
        >
          Convert
        </Button>
      </Flex>
    </Modal>
  )
}
