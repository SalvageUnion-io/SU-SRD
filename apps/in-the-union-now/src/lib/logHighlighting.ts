import type { ReactNode } from 'react'
import { createElement } from 'react'

type EntityColor = 'crawler' | 'mech' | 'pilot'

type NameEntry = {
  name: string
  color: EntityColor
}

export type NameRegistry = NameEntry[]

const COLOR_VAR: Record<EntityColor, string> = {
  crawler: 'var(--color-crawler)',
  mech: 'var(--color-mech)',
  pilot: 'var(--color-pilot)',
}

type RegistryInput = {
  crawlerName?: string | null
  pilotCallsigns?: string[]
  mechPatternNames?: string[]
}

/**
 * Build a sorted name registry (longest first) to prevent partial matches.
 */
export function buildNameRegistry(input: RegistryInput): NameRegistry {
  const entries: NameEntry[] = []

  if (input.crawlerName) {
    entries.push({ name: input.crawlerName, color: 'crawler' })
  }

  for (const callsign of input.pilotCallsigns ?? []) {
    if (callsign) entries.push({ name: callsign, color: 'pilot' })
  }

  for (const pattern of input.mechPatternNames ?? []) {
    if (pattern) entries.push({ name: pattern, color: 'mech' })
  }

  // Sort longest first to prevent partial matches
  entries.sort((a, b) => b.name.length - a.name.length)

  return entries
}

type HighlightSegment = { text: string; color?: EntityColor }

/**
 * Scan description for known entity names and return an array of
 * React nodes with colored spans for matches.
 */
export function highlightEntityNames(description: string, registry: NameRegistry): ReactNode[] {
  if (registry.length === 0 || !description) {
    return [description]
  }

  const segments = splitIntoSegments(description, registry)

  return segments.map((seg, i) => {
    if (!seg.color) return seg.text
    return createElement(
      'span',
      {
        key: i,
        style: { color: COLOR_VAR[seg.color], fontWeight: 600 },
      },
      seg.text
    )
  })
}

function splitIntoSegments(text: string, registry: NameRegistry): HighlightSegment[] {
  const segments: HighlightSegment[] = [{ text }]

  for (const entry of registry) {
    const result: HighlightSegment[] = []
    for (const seg of segments) {
      if (seg.color) {
        // Already highlighted, don't split further
        result.push(seg)
        continue
      }
      const parts = splitByName(seg.text, entry.name, entry.color)
      result.push(...parts)
    }
    segments.length = 0
    segments.push(...result)
  }

  return segments
}

function splitByName(text: string, name: string, color: EntityColor): HighlightSegment[] {
  const segments: HighlightSegment[] = []
  const lowerText = text.toLowerCase()
  const lowerName = name.toLowerCase()
  let lastIndex = 0

  let searchStart = 0
  while (searchStart < text.length) {
    const idx = lowerText.indexOf(lowerName, searchStart)
    if (idx === -1) break

    if (idx > lastIndex) {
      segments.push({ text: text.slice(lastIndex, idx) })
    }
    segments.push({ text: text.slice(idx, idx + name.length), color })
    lastIndex = idx + name.length
    searchStart = lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text }]
}
