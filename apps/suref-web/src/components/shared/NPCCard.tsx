import { Box, Flex, VStack } from '@chakra-ui/react'
import { SheetTextarea } from './SheetTextarea'
import { NPCCardChoice } from './NPCCardChoice'
import type { CrawlerNPC } from '../../types/common'
import type { Tables } from '../../types/database-generated.types'
import NumericStepper from '../NumericStepper'
import { Text } from '../base/Text'
import { useRef, useEffect, useState, useMemo } from 'react'
import { getTiltRotation } from '../../utils/tiltUtils'
import type { SURefCrawler, SURefCrawlerBay } from 'salvageunion-reference'

export function NPCCard({
  position,
  choices,
  description,
  referenceBay,
  npc,
  maxHP,
  tilted = false,
  disabled = false,
  onUpdateChoice,
  onUpdateBay,
}: {
  choices: Tables<'player_choices'>[]
  npc: CrawlerNPC
  referenceBay: SURefCrawler | SURefCrawlerBay | undefined
  onUpdateBay?: (updates: Partial<{ npc: CrawlerNPC }>) => void
  onUpdateChoice?: (id: string, value: string) => void
  position: string
  description: string
  maxHP: number
  tilted?: boolean
  disabled?: boolean
}) {
  const textRef = useRef<HTMLParagraphElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(16)
  const onUpdateDamage = (value: number) => onUpdateBay?.({ npc: { ...npc!, damage: value } })
  const onUpdateNotes = (value: string) => onUpdateBay?.({ npc: { ...npc!, notes: value } })

  const choiceDefinitions = useMemo(() => {
    if (!referenceBay) return []

    // Only get NPC choices, not bay-level choices (which have schema and are rendered in BayInfo)
    if ('npc' in referenceBay && referenceBay.npc && 'choices' in referenceBay.npc) {
      return referenceBay.npc.choices || []
    }
    return []
  }, [referenceBay])

  const choicesMap = useMemo(() => {
    return choices.reduce(
      (acc, choice) => {
        acc[choice.choice_ref_id] = choice.value
        return acc
      },
      {} as Record<string, string>
    )
  }, [choices])

  useEffect(() => {
    const adjustFontSize = () => {
      if (!textRef.current || !containerRef.current) return

      const maxHeight = 72
      const maxWidth = containerRef.current.offsetWidth
      let currentSize = 16

      textRef.current.style.fontSize = `${currentSize}px`

      while (
        (textRef.current.scrollHeight > maxHeight || textRef.current.scrollWidth > maxWidth) &&
        currentSize > 8
      ) {
        currentSize -= 0.5
        textRef.current.style.fontSize = `${currentSize}px`
      }

      setFontSize(currentSize)
    }

    adjustFontSize()
    window.addEventListener('resize', adjustFontSize)
    return () => window.removeEventListener('resize', adjustFontSize)
  }, [description])

  // Only calculate rotation on client to avoid hydration mismatch
  const rotation = useMemo(() => (tilted ? getTiltRotation() : 0), [tilted])
  const descriptionRotation = rotation
  const hpRotation = rotation
  const nameRotation = rotation
  const notesRotation = rotation

  return (
    <VStack gap={2} alignItems="stretch" mt={2} w="full">
      <Flex ref={containerRef} gap={3} alignItems="stretch" maxH="72px">
        <Box
          transform={tilted ? `rotate(${descriptionRotation}deg)` : undefined}
          transition="transform 0.3s ease"
        >
          <Text
            ref={textRef}
            fontStyle="italic"
            flex="1"
            display="flex"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            maxH="72px"
            lineHeight={1.2}
            style={{ fontSize: `${fontSize}px` }}
          >
            {description}
          </Text>
        </Box>
        {maxHP > 0 && (
          <Box
            transform={tilted ? `rotate(${hpRotation}deg)` : undefined}
            transition="transform 0.3s ease"
          >
            <NumericStepper
              label="NPC HP"
              max={maxHP}
              min={0}
              value={maxHP - (npc?.damage || 0)}
              onChange={(value) => onUpdateDamage(maxHP - value)}
              disabled={disabled}
            />
          </Box>
        )}
      </Flex>

      {choiceDefinitions.map((choice) => (
        <NPCCardChoice
          key={choice.id}
          choice={choice}
          position={position}
          value={choicesMap[choice.id] || ''}
          tilted={tilted}
          nameRotation={nameRotation}
          disabled={disabled}
          onUpdateChoice={onUpdateChoice}
        />
      ))}

      <Box
        transform={tilted ? `rotate(${notesRotation}deg)` : undefined}
        transition="transform 0.3s ease"
      >
        <SheetTextarea
          label="Notes"
          value={npc.notes}
          onChange={(value) => onUpdateNotes(value)}
          placeholder="Enter operator notes..."
          height="20"
          disabled={disabled}
        />
      </Box>
    </VStack>
  )
}
