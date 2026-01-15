import { VStack, Tabs } from '@chakra-ui/react'
import { useCallback } from 'react'
import { useSearch, useRouter } from '@tanstack/react-router'
import { Text } from '../../base/Text'
import { normalizePatternName } from 'salvageunion-reference'
import { EntitySubheader } from './EntitySubheader'
import { EntityChassisPattern } from './EntityChassisPattern'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export function EntityChassisPatterns() {
  const { data, spacing } = useEntityDisplayContext()
  const search = useSearch({ strict: false })
  const router = useRouter()

  const handlePatternChange = useCallback(
    (value: string) => {
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('pattern', value)
      router.history.replace(currentUrl.pathname + currentUrl.search)
    },
    [router]
  )

  if (!('patterns' in data) || !data.patterns || data.patterns.length === 0) return null

  const firstPattern = data.patterns[0]
  if (!firstPattern) return null

  const defaultPattern = normalizePatternName(firstPattern.name)

  const patternParam = (search as { pattern?: string }).pattern
  const selectedPattern = patternParam || defaultPattern

  return (
    <VStack p={spacing.contentPadding} gap={4} alignItems="stretch">
      <EntitySubheader label="Patterns" />

      <Tabs.Root value={selectedPattern} onValueChange={(e) => handlePatternChange(e.value)}>
        <Tabs.List borderBottom="3px solid" borderColor="border.default">
          {data.patterns.map((pattern) => {
            const displayName = normalizePatternName(pattern.name)
            const isLegalStarting = 'legalStarting' in pattern && pattern.legalStarting

            return (
              <Tabs.Trigger
                key={pattern.name}
                value={displayName}
                fontSize="lg"
                fontWeight="bold"
                color="fg.default"
                _selected={{
                  bg: 'su.green',
                  color: 'su.white',
                  borderBottomColor: 'su.green',
                }}
              >
                {displayName}
                {isLegalStarting && (
                  <Text as="span" ml={2} fontSize="2xl">
                    ★
                  </Text>
                )}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        {data.patterns.map((pattern) => {
          const displayName = normalizePatternName(pattern.name)
          return (
            <Tabs.Content key={pattern.name} value={displayName}>
              <EntityChassisPattern pattern={pattern} />
            </Tabs.Content>
          )
        })}
      </Tabs.Root>
    </VStack>
  )
}
