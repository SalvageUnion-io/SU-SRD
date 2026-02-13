import { useCallback, useEffect, useRef, useState } from 'react'
import type { SURefChassis } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { EntityChassisPattern } from './EntityChassisPattern'
import { cn } from '../../../utils/cn'

type EntityChassisPatternsProps = {
  patterns?: SURefChassis['patterns']
  headerFontSize?: string
}

export function EntityChassisPatterns({ patterns, headerFontSize }: EntityChassisPatternsProps) {
  const firstPattern = patterns?.[0]
  const defaultPattern = firstPattern ? normalizePatternName(firstPattern.name) : ''

  // Use local state for pattern selection (no router dependency)
  const [selectedPattern, setSelectedPattern] = useState(defaultPattern)
  const [panelMinHeight, setPanelMinHeight] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const handlePatternChange = useCallback((value: string) => {
    setSelectedPattern(value)
  }, [])

  useEffect(() => {
    if (panelRef.current) {
      const height = panelRef.current.scrollHeight
      setPanelMinHeight((prev) => Math.max(prev, height))
    }
  }, [selectedPattern])

  if (!patterns || patterns.length === 0 || !firstPattern) return null

  const activePattern = patterns.find((p) => normalizePatternName(p.name) === selectedPattern)

  return (
    <div className="clear-both space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-su-grey-light" />
        <Text variant="pseudoheader" className={cn(headerFontSize ?? 'text-lg')}>
          Patterns
        </Text>
        <div className="h-px flex-1 bg-su-grey-light" />
      </div>

      <div>
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
                  'flex-1 cursor-pointer px-3 py-2 text-center text-lg font-bold',
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
          <div
            ref={panelRef}
            role="tabpanel"
            style={panelMinHeight ? { minHeight: `${panelMinHeight}px` } : undefined}
          >
            <EntityChassisPattern pattern={activePattern} />
          </div>
        )}
      </div>
    </div>
  )
}
