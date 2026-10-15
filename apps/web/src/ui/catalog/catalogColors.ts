import type { CardDomain } from '../components/referenceEntity/card/entityCardTone'
import { resolveSchemaDomain } from '../components/referenceEntity/card/entityCardTone'

const techLevelGradient = [1, 2, 3, 4, 5, 6]
  .map((tl, i, arr) => {
    const start = ((i / arr.length) * 100).toFixed(1)
    const end = (((i + 1) / arr.length) * 100).toFixed(1)
    return `var(--color-tl-${tl}) ${start}%, var(--color-tl-${tl}) ${end}%`
  })
  .join(', ')

const techLevelBg = `linear-gradient(to right, ${techLevelGradient})`

/** The three ability tiers, in book order: Core (orange) · Advanced (rust) · Legendary (pink). */
const abilityGradient =
  'linear-gradient(to right, var(--color-pilot) 0%, var(--color-pilot) 33%, var(--color-tier-hybrid) 33%, var(--color-tier-hybrid) 66%, var(--color-crawler) 66%, var(--color-crawler) 100%)'

/** Core classes vs the hybrid classes they branch into: Hybrid is rust, as its tier is. */
const classGradient =
  'linear-gradient(to right, var(--color-pilot) 0%, var(--color-pilot) 60%, var(--color-tier-hybrid) 60%, var(--color-tier-hybrid) 100%)'

/**
 * Catalog tile background PER DOMAIN, in the colour the domain's entities wear
 * (`entityTone`): a tile that carries its name in text paints the band an
 * entity header with text paints, so crawler pink is the crawler band (ruleset
 * §3.8). The schema → domain grouping itself is NOT restated here — it comes
 * from `resolveSchemaDomain` in src/ui, so a new schema can't silently
 * fall through to a wrong default the way a hand-keyed schema list allowed.
 *
 * `gear` rides the tech-level ramp, matching how gear entities are toned.
 */
const DOMAIN_BG: Record<CardDomain, string> = {
  pilot: 'var(--color-pilot)',
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler-band)',
  actor: 'var(--color-adversary)',
  gear: techLevelBg,
  glossary: 'var(--color-ink-2)',
  // Actions never appear as a catalog tile; they have no schema of their own.
  action: 'var(--color-adversary)',
}

/**
 * Two schemas get a gradient rather than their flat domain colour, because the
 * tile is standing in for a whole SPREAD of entities rather than one hue:
 * abilities span the three tiers, classes span core → hybrid.
 */
export function getCatalogBg(schemaId: string): string {
  if (schemaId === 'abilities') return abilityGradient
  if (schemaId === 'classes') return classGradient
  const domain = resolveSchemaDomain(schemaId)
  return domain ? DOMAIN_BG[domain] : 'var(--color-pilot)'
}

/**
 * A tile whose background is a GRADIENT (the tech-level ramp, the tier
 * spreads) carries no single foreground, so its name sits on a paper chip,
 * as an entity's name does on a band no text passes on. Flat tiles print the
 * name straight on the tone.
 */
export function getCatalogLabel(schemaId: string): string | undefined {
  return getCatalogBg(schemaId).startsWith('linear-gradient(') ? 'var(--color-paper)' : undefined
}
