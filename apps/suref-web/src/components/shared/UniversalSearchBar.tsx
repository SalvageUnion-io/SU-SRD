import { useState, useMemo, useEffect, useRef, useCallback, startTransition } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { Box, Input, useBreakpointValue } from '@chakra-ui/react'
import { Text } from '../base/Text'
import type { SchemaInfo } from '../../types/schema'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { highlightMatch } from '../../utils/searchHighlight'
import { DEBOUNCE_TIMINGS } from '../../constants/gameRules'
import { getEntitySlug } from '../../utils/slug'
import { EntityDisplayTooltip } from '../entity/EntityDisplayTooltip'

const SEARCH_RESULTS_MAX_HEIGHT = 400

interface UniversalSearchBarProps {
  schemas: SchemaInfo[]
  /** Optional callback to call when a search result is selected */
  onResultSelect?: () => void
}

interface SearchResultDisplay {
  type: 'schema' | 'item'
  schemaId: string
  schemaTitle: string
  itemId?: string
  itemName?: string
  itemEntity?: SURefEntity
  matchText: string
  matchedFields?: string[]
}

export function UniversalSearchBar({ schemas, onResultSelect }: UniversalSearchBarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [localSearchValue, setLocalSearchValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousPathnameRef = useRef<string>(location.pathname)

  // Disable tooltips on mobile for better performance
  const isMobile = useBreakpointValue({ base: true, lg: false }) ?? true

  // Debounce search query for search results computation
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(localSearchValue)
    }, DEBOUNCE_TIMINGS.search)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [localSearchValue])

  const schemaMetadata = useMemo(
    () =>
      schemas.map((schema) => ({
        id: schema.id,
        title: schema.title,
        displayName: schema.title.replace('Salvage Union ', ''),
      })),
    [schemas]
  )

  const handleSelectResult = useCallback(
    (result: SearchResultDisplay) => {
      // Clear search state immediately
      setLocalSearchValue('')
      setSelectedIndex(0)

      // Navigate to the selected result
      if (result.type === 'schema') {
        navigate({
          to: '/schema/$schemaId',
          params: { schemaId: result.schemaId },
        })
      } else if (result.itemId) {
        // Use slug from entity if available, otherwise fallback to itemId
        const itemSlug = result.itemEntity ? getEntitySlug(result.itemEntity) : result.itemId
        navigate({
          to: '/schema/$schemaId/item/$itemId',
          params: { schemaId: result.schemaId, itemId: itemSlug },
        })
      }

      // Call the optional callback (e.g., to close drawer)
      onResultSelect?.()
    },
    [navigate, onResultSelect]
  )

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return []
    }

    const results: SearchResultDisplay[] = []

    for (const schema of schemaMetadata) {
      if (
        schema.displayName.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        schema.id.toLowerCase().includes(debouncedQuery.toLowerCase())
      ) {
        results.push({
          type: 'schema',
          schemaId: schema.id,
          schemaTitle: schema.displayName,
          matchText: schema.displayName,
        })
      }
    }

    const entityResults = SalvageUnionReference.search({
      query: debouncedQuery,
    })

    // Filter to only include results where the match was in the 'name' field
    for (const result of entityResults) {
      // Only include if the match was in the name field
      if (!result.matchedFields?.includes('name')) {
        continue
      }

      results.push({
        type: 'item',
        schemaId: result.schemaName,
        schemaTitle: result.schemaTitle.replace('Salvage Union ', ''),
        itemId: result.entityId,
        itemName: result.entityName,
        itemEntity: result.entity,
        matchText: result.entityName,
        matchedFields: result.matchedFields,
      })
    }

    return results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'schema' ? -1 : 1
      }
      return a.matchText.localeCompare(b.matchText)
    })
  }, [debouncedQuery, schemaMetadata])

  // Derive isOpen from search results and input value
  const isOpen = searchResults.length > 0 && localSearchValue.trim().length > 0

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (localSearchValue) {
          e.preventDefault()
          setLocalSearchValue('')
          setSelectedIndex(0)
        }
        return
      }

      if (!searchResults.length || !isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const result = searchResults[selectedIndex]
        if (result) {
          handleSelectResult(result)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchResults, selectedIndex, handleSelectResult, localSearchValue, isOpen])

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current && searchResults.length > 0) {
      const selectedElement = containerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      ) as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, searchResults])

  // Clear search bar when route changes
  useEffect(() => {
    // Only clear if pathname actually changed
    if (previousPathnameRef.current !== location.pathname) {
      previousPathnameRef.current = location.pathname
      // Clear debounced query timer synchronously (external system)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      // Use startTransition to batch state updates and avoid cascading renders
      startTransition(() => {
        setLocalSearchValue('')
        setSelectedIndex(0)
        setDebouncedQuery('')
      })
    }
  }, [location.pathname])

  return (
    <Box position="relative" w="full" p={2}>
      <Box position="relative">
        <Box
          position="absolute"
          left={3}
          top="50%"
          transform="translateY(-50%)"
          zIndex={1}
          pointerEvents="none"
          color="fg.muted"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </Box>
        <Input
          ref={inputRef}
          value={localSearchValue}
          onChange={(e) => {
            setLocalSearchValue(e.target.value)
            setSelectedIndex(0)
          }}
          placeholder="Search SRD..."
          size="sm"
          bg="su.white"
          borderWidth="1px"
          borderColor="border.default"
          pl={10}
          _focus={{
            borderColor: 'su.orange',
            outline: 'none',
          }}
          _hover={{
            borderColor: 'su.orange',
          }}
        />
      </Box>

      {isOpen && searchResults.length > 0 && (
        <Box
          ref={containerRef}
          position="absolute"
          top="100%"
          left={0}
          right={0}
          mt={1}
          bg="bg.canvas"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="md"
          shadow="lg"
          maxH={`${SEARCH_RESULTS_MAX_HEIGHT}px`}
          overflowY="auto"
          zIndex={50}
        >
          {searchResults.map((result, index) => {
            // Since we only search names, always highlight in the title
            let titleHighlighted = null
            if (debouncedQuery) {
              const lowerTitle = result.matchText.toLowerCase()
              const lowerQuery = debouncedQuery.toLowerCase()
              const matchIndex = lowerTitle.indexOf(lowerQuery)
              if (matchIndex !== -1) {
                titleHighlighted = highlightMatch(
                  result.matchText,
                  matchIndex,
                  matchIndex + debouncedQuery.length
                )
              }
            }

            const resultContent = (
              <Box
                key={`${result.type}-${result.schemaId}-${result.itemId || result.schemaId}`}
                data-index={index}
                px={4}
                py={3}
                cursor="pointer"
                bg={index === selectedIndex ? 'bg.hover' : 'transparent'}
                _hover={{ bg: 'bg.hover' }}
                onClick={() => {
                  handleSelectResult(result)
                }}
                borderBottomWidth={index < searchResults.length - 1 ? '1px' : 0}
                borderBottomColor="border.default"
              >
                <Text fontWeight="semibold" color="fg.default" lineHeight="1.4">
                  {titleHighlighted ? (
                    <>
                      {titleHighlighted.before}
                      <Box as="mark" bg="su.orange" color="su.white" px={0.5}>
                        {titleHighlighted.match}
                      </Box>
                      {titleHighlighted.after}
                    </>
                  ) : (
                    result.matchText
                  )}
                </Text>
                <Text fontSize="sm" color="fg.muted" mt={1} lineHeight="1.4">
                  {result.type === 'schema' ? 'Schema' : result.schemaTitle}
                </Text>
              </Box>
            )

            // Wrap item results with EntityDisplayTooltip if entity is available
            // Only on desktop - disable on mobile for better performance
            if (!isMobile && result.type === 'item' && result.itemEntity && result.itemId) {
              return (
                <EntityDisplayTooltip
                  key={`${result.type}-${result.schemaId}-${result.itemId}`}
                  schemaName={result.schemaId as SURefEnumSchemaName}
                  entityId={result.itemId}
                  openDelay={300}
                  fullWidth
                >
                  {resultContent}
                </EntityDisplayTooltip>
              )
            }

            return resultContent
          })}
        </Box>
      )}
    </Box>
  )
}
