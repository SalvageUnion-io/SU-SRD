import { useState, useMemo } from 'react'
import { Button, Flex, Grid } from '@chakra-ui/react'
import NumericStepper from '../NumericStepper'
import { Card } from '../shared/Card'
import { StatDisplay } from '../StatDisplay'
import { ScrapConversionModal } from './ScrapConversionModal'
import { useHydratedCrawler, useUpdateCrawler } from '../../hooks/crawler'

interface CrawlerResourceSteppersProps {
  id: string
  /** Disables all steppers */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
  flashingTLs?: number[]
}

export function CrawlerResourceSteppers({
  id,
  disabled = false,
  incomplete = false,
  flashingTLs = [],
}: CrawlerResourceSteppersProps) {
  const { crawler } = useHydratedCrawler(id)
  const updateCrawler = useUpdateCrawler()
  const scrap_tl_one = crawler?.scrap_tl_one ?? 0
  const scrap_tl_two = crawler?.scrap_tl_two ?? 0
  const scrap_tl_three = crawler?.scrap_tl_three ?? 0
  const scrap_tl_four = crawler?.scrap_tl_four ?? 0
  const scrap_tl_five = crawler?.scrap_tl_five ?? 0
  const scrap_tl_six = crawler?.scrap_tl_six ?? 0

  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false)

  const flashStates = useMemo(() => {
    const states: Record<number, boolean> = {}
    flashingTLs.forEach((tl) => {
      states[tl] = true
    })
    return states
  }, [flashingTLs])

  const scrapByTL = useMemo(
    () => ({
      1: scrap_tl_one,
      2: scrap_tl_two,
      3: scrap_tl_three,
      4: scrap_tl_four,
      5: scrap_tl_five,
      6: scrap_tl_six,
    }),
    [scrap_tl_one, scrap_tl_two, scrap_tl_three, scrap_tl_four, scrap_tl_five, scrap_tl_six]
  )

  const totalInTl1 = useMemo(
    () =>
      (scrapByTL[1] ?? 0) +
      (scrapByTL[2] ?? 0) * 2 +
      (scrapByTL[3] ?? 0) * 3 +
      (scrapByTL[4] ?? 0) * 4 +
      (scrapByTL[5] ?? 0) * 5 +
      (scrapByTL[6] ?? 0) * 6,
    [scrapByTL]
  )

  return (
    <>
      <Card
        title="SCRAP"
        bg="bg.builder.crawler"
        disabled={incomplete}
        justifyContent="flex-start"
        rightContent={
          <StatDisplay
            compact
            label=""
            bottomLabel="TL1"
            value={totalInTl1}
            disabled={incomplete}
            hoverText="Total Scrap converted to Tech Level 1 equivalent. Higher Tech Level Scrap is worth more: TL2 = 2× TL1, TL3 = 3× TL1, etc."
          />
        }
      >
        <Grid gridTemplateColumns="repeat(2, 1fr)" gap={4}>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL1"
              value={scrap_tl_one ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_one: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[1]}
            />
          </Flex>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL2"
              value={scrap_tl_two ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_two: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[2]}
            />
          </Flex>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL3"
              value={scrap_tl_three ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_three: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[3]}
            />
          </Flex>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL4"
              value={scrap_tl_four ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_four: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[4]}
            />
          </Flex>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL5"
              value={scrap_tl_five ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_five: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[5]}
            />
          </Flex>
          <Flex justifyContent="start" alignItems="end">
            <NumericStepper
              label="TL6"
              value={scrap_tl_six ?? 0}
              onChange={(value) => updateCrawler.mutate({ id, updates: { scrap_tl_six: value } })}
              min={0}
              disabled={disabled}
              flash={flashStates[6]}
            />
          </Flex>
        </Grid>

        <Button
          w="full"
          mt={4}
          bg="su.black"
          color="su.white"
          _hover={{ bg: 'brand.srd' }}
          fontWeight="bold"
          py={2}
          borderRadius="md"
          onClick={() => setIsConversionModalOpen(true)}
          disabled={disabled || totalInTl1 <= 1}
        >
          CONVERT
        </Button>
      </Card>

      <ScrapConversionModal
        isOpen={isConversionModalOpen}
        onClose={() => setIsConversionModalOpen(false)}
        scrapTlOne={scrap_tl_one ?? 0}
        scrapTlTwo={scrap_tl_two ?? 0}
        scrapTlThree={scrap_tl_three ?? 0}
        scrapTlFour={scrap_tl_four ?? 0}
        scrapTlFive={scrap_tl_five ?? 0}
        scrapTlSix={scrap_tl_six ?? 0}
        onConvert={(updates) => updateCrawler.mutate({ id, updates })}
      />
    </>
  )
}
