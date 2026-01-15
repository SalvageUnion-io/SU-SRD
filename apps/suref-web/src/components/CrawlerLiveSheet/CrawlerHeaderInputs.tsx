import { Flex, Grid, VStack } from '@chakra-ui/react'
import { SheetInput } from '../shared/SheetInput'
import { SheetSelect } from '../shared/SheetSelect'
import { SheetTextarea } from '../shared/SheetTextarea'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Card } from '../shared/Card'
import NumericStepper from '../NumericStepper'
import { StatDisplay } from '../StatDisplay'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { MAX_UPGRADE, UPKEEP_STEP } from '../../constants/gameRules'
import { useHydratedCrawler, useUpdateCrawler } from '../../hooks/crawler'
import { useOnCrawlerTypeChange } from '../../hooks/crawler/useOnCrawlerTypeChange'
import { calculateScrapRemoval, hasEnoughScrapAtTechLevel } from '../../utils/scrapCalculations'

interface CrawlerHeaderInputsProps {
  /** Disables all inputs */
  disabled?: boolean
  /** Greys out the Card background (only for missing required data) */
  incomplete?: boolean
  id: string
}

export function CrawlerHeaderInputs({
  disabled = false,
  incomplete = false,
  id,
}: CrawlerHeaderInputsProps) {
  const allCrawlers = useMemo(() => SalvageUnionReference.Crawlers.all(), [])

  const { crawler, upkeep, maxSP, selectedCrawlerType } = useHydratedCrawler(id)
  const currentUpgrade = crawler?.upgrade ?? 0
  const currentTechLevel = crawler?.tech_level || 1
  const isMaxUpgrade = currentUpgrade === MAX_UPGRADE
  const isTechLevel6 = currentTechLevel === 6
  const currentSP = maxSP - (crawler?.current_damage ?? 0)
  const [flashUpkeep, setFlashUpkeep] = useState(false)
  const [flashTL, setFlashTL] = useState(false)
  const [flashUpgradeDisplay, setFlashUpgradeDisplay] = useState(false)
  const [flashSP, setFlashSP] = useState(false)
  const updateCrawler = useUpdateCrawler()

  const handleUpgradeToNextTechLevel = () => {
    if (isMaxUpgrade && currentTechLevel < 6) {
      setFlashUpkeep(true)
      setFlashTL(true)
      setFlashUpgradeDisplay(true)
      setFlashSP(true)

      updateCrawler.mutate({
        id,
        updates: {
          tech_level: currentTechLevel + 1,
          upgrade: 0,
        },
      })
    }
  }

  const scrapByTL = useMemo(
    () => ({
      1: crawler?.scrap_tl_one ?? 0,
      2: crawler?.scrap_tl_two ?? 0,
      3: crawler?.scrap_tl_three ?? 0,
      4: crawler?.scrap_tl_four ?? 0,
      5: crawler?.scrap_tl_five ?? 0,
      6: crawler?.scrap_tl_six ?? 0,
    }),
    [
      crawler?.scrap_tl_one,
      crawler?.scrap_tl_two,
      crawler?.scrap_tl_three,
      crawler?.scrap_tl_four,
      crawler?.scrap_tl_five,
      crawler?.scrap_tl_six,
    ]
  )

  const canIncrementUpgrade = useMemo(() => {
    if (currentUpgrade >= MAX_UPGRADE) return false
    return hasEnoughScrapAtTechLevel(UPKEEP_STEP, currentTechLevel, scrapByTL)
  }, [currentUpgrade, currentTechLevel, scrapByTL])

  const handleUpgradeChange = useCallback(
    (newValue: number) => {
      const isIncrement = newValue > currentUpgrade

      if (isIncrement) {
        if (hasEnoughScrapAtTechLevel(UPKEEP_STEP, currentTechLevel, scrapByTL)) {
          const upkeepCost = UPKEEP_STEP * currentTechLevel
          const { updates: scrapUpdates } = calculateScrapRemoval(upkeepCost, scrapByTL)

          setFlashUpkeep(true)
          setFlashTL(true)

          updateCrawler.mutate({ id, updates: { upgrade: newValue, ...scrapUpdates } })
        }
      } else {
        updateCrawler.mutate({ id, updates: { upgrade: newValue } })
      }
    },
    [currentUpgrade, currentTechLevel, scrapByTL, updateCrawler, id]
  )

  const onCrawlerTypeChange = useOnCrawlerTypeChange(id)

  useEffect(() => {
    if (flashUpkeep) {
      const timer = setTimeout(() => setFlashUpkeep(false), 3100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [flashUpkeep])

  useEffect(() => {
    if (flashTL) {
      const timer = setTimeout(() => setFlashTL(false), 3100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [flashTL])

  useEffect(() => {
    if (flashUpgradeDisplay) {
      const timer = setTimeout(() => setFlashUpgradeDisplay(false), 3100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [flashUpgradeDisplay])

  useEffect(() => {
    if (flashSP) {
      const timer = setTimeout(() => setFlashSP(false), 3100)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [flashSP])

  return (
    <Card
      title={crawler?.name ?? 'Crawler'}
      bg="bg.builder.crawler"
      flex="1"
      disabled={incomplete}
      leftContent={
        isMaxUpgrade && !isTechLevel6 ? (
          <StatDisplay
            label="UPGRADE"
            value={currentTechLevel + 1}
            onClick={handleUpgradeToNextTechLevel}
            disabled={disabled}
            bg="brand.srd"
            valueColor="su.white"
            ariaLabel={`Upgrade to Tech Level ${currentTechLevel + 1}`}
            flash={flashTL}
            hoverText="If you pay the Upkeep on your Union Crawler in full, the amount of Upkeep you spend goes towards your Upgrade Pool. When the Upgrade Pool reaches the Upgrade Value of your Union Crawler, you may choose to upgrade it. When upgraded, it will boost the Tech Level of Union Crawler to the next Tech Level, and give it all of the new statistics."
          />
        ) : (
          <StatDisplay
            label="TECH"
            bottomLabel="LEVEL"
            inverse
            value={currentTechLevel}
            disabled={disabled}
            flash={flashTL}
            hoverText="How advanced the Union Crawler and the facilities are within it, as well as its size. A Union Crawler starts at Tech Level 1."
          />
        )
      }
      rightContent={
        <Flex gap="2">
          <StatDisplay
            disabled={disabled}
            label="UPKEEP"
            value={upkeep}
            flash={flashUpkeep}
            hoverText="Your Union Crawler requires a constant influx of Scrap to maintain it. This is represented by its Upkeep Cost. This must be paid once per week, but for simplicity in play, this is resolved during Downtime. By default, the Upkeep Cost is 5 Scrap of the Tech Level of the Union Crawler. The Upkeep you pay will also add to your Union Crawler Upgrade Pool."
          />
          <NumericStepper
            label="UPGRADE"
            value={currentUpgrade}
            onChange={handleUpgradeChange}
            max={MAX_UPGRADE}
            min={0}
            disabled={disabled}
            disableIncrement={!canIncrementUpgrade}
            flash={flashUpgradeDisplay}
            hoverText="If you pay the Upkeep on your Union Crawler in full, the amount of Upkeep you spend goes towards your Upgrade Pool. When the Upgrade Pool reaches the Upgrade Value of your Union Crawler, you may choose to upgrade it. When upgraded, it will boost the Tech Level of Union Crawler to the next Tech Level, and give it all of the new statistics."
          />
          <NumericStepper
            label="SP"
            value={currentSP}
            onChange={(newSP) =>
              updateCrawler.mutate({ id, updates: { current_damage: maxSP - newSP } })
            }
            max={maxSP}
            min={0}
            disabled={disabled}
            flash={flashSP}
            hoverText="Structure Points represent how tough and sturdy your Mech is, and how much damage it can take. This is an abstract measure representing a broad range of factors ranging from sheer bulk and armour to wider defensive capabilities."
          />
        </Flex>
      }
    >
      <VStack gap={4} alignItems="stretch" w="full" h="full" flex="1">
        <Grid gridTemplateColumns="repeat(2, 1fr)" gap={4} w="full">
          <SheetInput
            label="Name"
            value={crawler?.name ?? ''}
            onChange={(value) => updateCrawler.mutate({ id, updates: { name: value } })}
            placeholder="Enter crawler name..."
            disabled={disabled}
            isOwner={!disabled}
          />

          <SheetSelect
            label="Type"
            value={selectedCrawlerType?.schema_ref_id ?? ''}
            onChange={onCrawlerTypeChange}
            disabled={disabled}
            isOwner={!disabled}
          >
            <option value="">Select crawler type...</option>
            {allCrawlers.map((crawler) => (
              <option key={crawler.id} value={crawler.id}>
                {crawler.name}
              </option>
            ))}
          </SheetSelect>
        </Grid>

        <Flex flex="1" direction="column" minH="0" w="full">
          <SheetTextarea
            label="Description"
            value={crawler?.description ?? ''}
            onChange={(value) => updateCrawler.mutate({ id, updates: { description: value } })}
            placeholder="Enter crawler description..."
            disabled={disabled}
            isOwner={!disabled}
            height="full"
          />
        </Flex>
      </VStack>
    </Card>
  )
}
