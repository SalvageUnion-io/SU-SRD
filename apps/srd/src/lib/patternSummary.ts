import type { StaticEntitySummary, SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import {
  extractStaticEntitySummary,
  normalizePatternName,
  plainTraitText,
} from 'salvageunion-reference'

/** `[{ name, count? }]` → `"Rigging Arm, Floodlights ×2"`. */
function loadoutLine(items: { name: string; count?: number }[] | undefined): string | undefined {
  if (!items || items.length === 0) return undefined
  return items.map((i) => (i.count && i.count > 1 ? `${i.name} ×${i.count}` : i.name)).join(', ')
}

/**
 * The SEO / no-JS summary for a chassis PATTERN page.
 *
 * A pattern has no entity of its own, so this is its chassis's summary (stats,
 * source, traits — all of which a pattern inherits) re-titled for the pattern
 * and with the prose put in the same reading order the rendered page uses: the
 * pattern first — its prose, then the loadout that distinguishes one pattern of
 * a chassis from another — and the base chassis's prose after it, as a section
 * named for the chassis ("Mule chassis"). The loadout matters most here — it is
 * the only part of a pattern a crawler cannot otherwise see, since the systems
 * and modules render as nested cards inside the island.
 */
export function patternStaticSummary(
  chassis: SURefEntity,
  pattern: SURefObjectPattern
): StaticEntitySummary {
  const chassisSummary = extractStaticEntitySummary(chassis)
  const patternName = normalizePatternName(pattern.name)

  const patternParagraphs = (pattern.content ?? [])
    .filter(
      (block) =>
        block && (!block.type || block.type === 'paragraph') && typeof block.value === 'string'
    )
    .map((block) => plainTraitText(String(block.value)))

  const systems = loadoutLine(pattern.systems)
  const modules = loadoutLine(pattern.modules)
  const [lead, ...rest] = patternParagraphs

  // With no prose of its own, the pattern's description IS the chassis's, so
  // the chassis section does not repeat it.
  const chassisParagraphs = [
    ...(lead && chassisSummary.description ? [chassisSummary.description] : []),
    ...chassisSummary.contentParagraphs,
  ]

  return {
    ...chassisSummary,
    name: `${patternName} — ${chassisSummary.name} Pattern`,
    description: lead ?? chassisSummary.description,
    contentParagraphs: [
      ...rest,
      ...(systems ? [`Systems: ${systems}.`] : []),
      ...(modules ? [`Modules: ${modules}.`] : []),
    ],
    sections: [
      ...(chassisParagraphs.length > 0
        ? [{ name: `${chassisSummary.name} chassis`, paragraphs: chassisParagraphs }]
        : []),
      ...chassisSummary.sections,
    ],
  }
}
