import { useCallback, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { EntitySubheader } from './EntitySubheader'
import { EntityChassisPattern } from './EntityChassisPattern'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes } from './entityDisplayTypes'

type EntityChassisPatternsProps = {
  data: SURefEntity
  fontSize: ReturnType<typeof getEntityFontSizes>
}

export function EntityChassisPatterns({ data, fontSize }: EntityChassisPatternsProps) {
  const patterns = 'patterns' in data ? data.patterns : undefined
  const firstPattern = patterns?.[0]
  const defaultPattern = firstPattern ? normalizePatternName(firstPattern.name) : ''

  // Use local state for pattern selection (no router dependency)
  const [selectedPattern, setSelectedPattern] = useState(defaultPattern)

  const handlePatternChange = useCallback((value: string) => {
    setSelectedPattern(value)
  }, [])

  if (!patterns || patterns.length === 0 || !firstPattern) return null

  const activePattern = patterns.find((p) => normalizePatternName(p.name) === selectedPattern)

  return (
    <div className="clear-both space-y-4">
      <EntitySubheader label="Patterns" fontSize={fontSize} />

      {/* Tab navigation */}
      <div role="tablist" className="flex border-b-[3px] border-gray-200">
        {patterns.map((pattern) => {
          const displayName = normalizePatternName(pattern.name)
          const isActive = selectedPattern === displayName
          const isLegalStarting = 'legalStarting' in pattern && pattern.legalStarting

          return (
            <button
              key={pattern.name}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handlePatternChange(displayName)}
              className={cn(
                'cursor-pointer px-3 py-2 text-lg font-bold',
                isActive ? 'bg-su-green text-su-white' : 'text-su-black hover:bg-gray-100'
              )}
            >
              {displayName}
              {isLegalStarting && (
                <Text as="span" className="ml-2 text-2xl">
                  {'\u2605'}
                </Text>
              )}
            </button>
          )
        })}
      </div>

      {/* Active pattern content */}
      {activePattern && (
        <div role="tabpanel">
          <EntityChassisPattern pattern={activePattern} />
        </div>
      )}
    </div>
  )
}
