import type { RefEntity, RefObjectAnyPattern, StaticEntitySummary } from 'salvageunion-reference'
import {
  extractContentText,
  extractPatternActions,
  extractStaticEntitySummary,
  isBioTitanPattern,
  normalizePatternName,
  plainTraitText,
} from 'salvageunion-reference'

/** `[{ name, count? }]` → `"Rigging Arm, Floodlights ×2"`. */
function loadoutLine(items: { name: string; count?: number }[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined
  return items.map((i) => (i.count && i.count > 1 ? `${i.name} ×${i.count}` : i.name)).join(', ')
}

/**
 * The SEO / no-JS summary for a PATTERN page — a chassis's mech pattern or a
 * Bio-Titan's variant.
 *
 * A pattern has no entity of its own, so this is its host's summary (stats,
 * source, traits — all of which a pattern inherits) re-titled for the pattern
 * and with the prose put in the same reading order the rendered page uses: the
 * pattern first — its prose, then what distinguishes one pattern of a host from
 * another (a mech pattern's loadout, a Bio-Titan pattern's added actions) — and
 * the host's prose after it, as a section named for the host ("Mule chassis").
 * That difference matters most here — it is the only part of a pattern a
 * crawler cannot otherwise see, since it renders as nested cards inside the
 * island.
 */
export function patternStaticSummary(
  host: RefEntity,
  pattern: RefObjectAnyPattern,
  /** Keep `[[Trait]]` markup for a renderer that draws Mentions (the fallback). */
  options: { keepReferences?: boolean } = {}
): StaticEntitySummary {
  const hostSummary = extractStaticEntitySummary(host, options)
  const prose = options.keepReferences ? (text: string) => text : plainTraitText
  const patternName = normalizePatternName(pattern.name)

  const patternParagraphs = (pattern.content ?? [])
    .filter(
      (block) =>
        block && (!block.type || block.type === 'paragraph') && typeof block.value === 'string'
    )
    .map((block) => prose(String(block.value)))

  const systems = 'systems' in pattern ? loadoutLine(pattern.systems) : undefined
  const modules = 'modules' in pattern ? loadoutLine(pattern.modules) : undefined
  const addedActions = extractPatternActions(pattern).map(
    (action) => `${action.name}: ${extractContentText(action.content ?? [])}`
  )
  const [lead, ...rest] = patternParagraphs

  // With no prose of its own, the pattern's description IS the host's, so the
  // host section does not repeat it.
  const hostParagraphs = [
    ...(lead && hostSummary.description ? [hostSummary.description] : []),
    ...hostSummary.contentParagraphs,
  ]
  const hostKind = isBioTitanPattern(pattern) ? 'Bio-Titan' : 'chassis'

  return {
    ...hostSummary,
    name: `${patternName} — ${hostSummary.name} Pattern`,
    description: lead ?? hostSummary.description,
    contentParagraphs: [
      ...rest,
      ...(systems ? [`Systems: ${systems}.`] : []),
      ...(modules ? [`Modules: ${modules}.`] : []),
      ...addedActions,
    ],
    sections: [
      ...(hostParagraphs.length > 0
        ? [{ name: `${hostSummary.name} ${hostKind}`, paragraphs: hostParagraphs }]
        : []),
      ...hostSummary.sections,
    ],
  }
}
