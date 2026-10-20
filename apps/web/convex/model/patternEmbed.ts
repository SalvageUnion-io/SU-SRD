import type { RefMetaEntity, RefObjectPattern } from 'salvageunion-reference'
import { componentEmbedJson, discordHomebrewPatternCard } from 'salvageunion-reference'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { loadReferenceData } from './referenceData'

/** The slice of a saved pattern's body its card reads. */
type PatternBody = {
  name?: unknown
  chassisRef?: unknown
  systems?: unknown
  modules?: unknown
  notes?: unknown
}

const slugs = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** An `http(s)` origin or URL, or null for anything else a caller hands in. */
function webUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/**
 * A shared pattern's Discord Component Embed (its page's unfurl), as the
 * card its chassis's book patterns get, marked homebrew
 * (`discordHomebrewPatternCard`): its name, description and loadout on its
 * chassis, credited to its maker, its title linking its page under `appUrl`
 * and its parts their SRD pages on that origin. Null when its chassis is not
 * in the reference, or `appUrl` is not a web address.
 */
export function patternEmbedJson(
  body: unknown,
  madeBy: string,
  appUrl: string,
  appId: string
): string | null {
  const app = webUrl(appUrl)
  if (!app || typeof body !== 'object' || body === null) return null
  const page = new URL(
    `${app.pathname.replace(/\/+$/, '')}/p/pattern/${encodeURIComponent(appId)}`,
    app.origin
  )
  const { name, chassisRef, systems, modules, notes } = body as PatternBody
  if (typeof name !== 'string' || typeof chassisRef !== 'string') return null
  loadReferenceData()
  const chassis = resolveChassisRef(chassisRef)
  if (!chassis) return null
  const description = typeof notes === 'string' ? notes.trim() : ''
  const pattern: RefObjectPattern = {
    name,
    systems: slugs(systems).flatMap((ref) => {
      const system = resolveSystemRef(ref)
      return system ? [{ name: system.name }] : []
    }),
    modules: slugs(modules).flatMap((ref) => {
      const module = resolveModuleRef(ref)
      return module ? [{ name: module.name }] : []
    }),
    ...(description ? { content: [{ type: 'paragraph' as const, value: description }] } : {}),
  }
  return componentEmbedJson(
    discordHomebrewPatternCard(
      chassis as RefMetaEntity,
      pattern,
      { url: page.href, madeBy },
      { srdOrigin: app.origin }
    )
  )
}
