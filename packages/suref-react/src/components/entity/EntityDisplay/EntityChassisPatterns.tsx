import { useCallback, useEffect, useId, useRef, useState } from 'react'
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
  const baseId = useId()

  // Use local state for pattern selection (no router dependency)
  const [selectedPattern, setSelectedPattern] = useState(defaultPattern)
  const [panelMinHeight, setPanelMinHeight] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const tablistRef = useRef<HTMLDivElement>(null)

  const handlePatternChange = useCallback((value: string) => {
    setSelectedPattern(value)
  }, [])

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!patterns || patterns.length <= 1) return
      const names = patterns.map((p) => normalizePatternName(p.name))
      const currentIdx = names.indexOf(selectedPattern)

      let nextIdx: number | null = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        nextIdx = (currentIdx + 1) % names.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        nextIdx = (currentIdx - 1 + names.length) % names.length
      } else if (e.key === 'Home') {
        e.preventDefault()
        nextIdx = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        nextIdx = names.length - 1
      }

      if (nextIdx !== null) {
        setSelectedPattern(names[nextIdx]!)
        const tabBtn = tablistRef.current?.querySelector<HTMLButtonElement>(
          `[id="${baseId}-tab-${nextIdx}"]`
        )
        tabBtn?.focus()
      }
    },
    [patterns, selectedPattern, baseId]
  )

  useEffect(() => {
    if (panelRef.current) {
      const height = panelRef.current.scrollHeight
      setPanelMinHeight((prev) => Math.max(prev, height))
    }
  }, [selectedPattern])

  if (!patterns || patterns.length === 0 || !firstPattern) return null

  const activePattern = patterns.find((p) => normalizePatternName(p.name) === selectedPattern)
  const activeIdx = patterns.findIndex((p) => normalizePatternName(p.name) === selectedPattern)
  const panelId = `${baseId}-tabpanel`

  return (
    <div className="clear-both space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
        <Text variant="pseudoheader" className={cn(headerFontSize ?? 'text-lg')}>
          Patterns
        </Text>
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      </div>

      <div>
        {/* Tab navigation */}
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Chassis patterns"
          className="flex border-b-[3px] border-gray-200"
        >
          {patterns.map((pattern, idx) => {
            const displayName = normalizePatternName(pattern.name)
            const isActive = selectedPattern === displayName
            const isLegalStarting = 'legalStarting' in pattern && pattern.legalStarting
            const tabId = `${baseId}-tab-${idx}`

            return (
              <button
                key={pattern.name}
                id={tabId}
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handlePatternChange(displayName)}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  'flex-1 cursor-pointer px-3 py-2 text-center text-lg font-bold',
                  isActive ? 'bg-su-green text-su-white' : 'text-su-black hover:bg-gray-100'
                )}
              >
                {displayName}
                {isLegalStarting && (
                  <Text as="span" className="ml-2 text-2xl" aria-label="Legal starting pattern">
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
            id={panelId}
            ref={panelRef}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${activeIdx}`}
            style={panelMinHeight ? { minHeight: `${panelMinHeight}px` } : undefined}
          >
            <EntityChassisPattern pattern={activePattern} />
          </div>
        )}
      </div>
    </div>
  )
}
