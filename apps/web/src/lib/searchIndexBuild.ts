/**
 * Build-time compact search index generator (Node-only — imports gameData.ts,
 * which preloads the full ORM at module load; never import this from a
 * client island). Consumed by `src/reference/endpoints/searchIndexJson.ts`, a static
 * endpoint generated once at build time and fetched lazily by
 * `useSearchIndex.ts` on first search interaction.
 *
 * Mirrors the field extraction `salvageunion-reference`'s internal
 * `buildSearchIndex` (lib/search.ts) uses — name, description, effect,
 * goals, assets, weaknesses, content, resolved action content and the
 * host's patterns (`patternSearchText`) — but
 * flattens everything into one lowercased `text` field and drops the full
 * entity, since the client only needs to match a query and link to the
 * entity's page (see `searchIndexTypes.ts`). This is a deliberate,
 * documented trade-off (see `searchCompactIndex.ts`): the client matcher
 * loses per-field match weighting, in exchange for not shipping the full
 * corpus to the browser.
 */

import type { RefEntity, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  extractContentText,
  getEntitySlug,
  getPatterns,
  isSchemaName,
  nameToSlug,
  patternSearchText,
  rulesSearchText,
  searchAliases,
  searchSquashedName,
  toEntityModel,
} from 'salvageunion-reference'
// `extractContentText` and `isSchemaName` are the package's own primitives —
// this module is Node-only and already loads the ORM, so importing them costs
// nothing and keeps the index's field extraction byte-identical to the
// ORM-backed `search()` it mirrors.
import { TRAINING_POINTS } from '../components/entity'
import type { EntityFormModel } from '../components/index'
import { itemHref, patternHref } from './entityHref'
import { getEntitySchemas, getModel, SalvageUnionReference } from './gameData'
import { listingEntries } from './listingEntries'
import type { CompactSearchEntry } from './searchIndexTypes'

const TEXT_FIELDS = ['description', 'effect', 'goals', 'assets', 'weaknesses'] as const

/** A search result's kind for a pattern, which has no schema to name it. */
const PATTERN_KIND = 'Pattern'

/** The Compact's parts of an entity's model, for a search result (no lead, no hints). */
function rowModel(entity: RefEntity, pattern?: RefObjectAnyPattern): EntityFormModel {
  const m = toEntityModel(entity, undefined, pattern ? { pattern } : undefined)
  return {
    ref: m.ref,
    title: m.title,
    kind: m.kind,
    tone: m.tone,
    facts: m.facts.map(({ hint: _hint, ...fact }) => fact),
    traits: m.traits,
    art: m.art,
    ...(m.tier ? { tier: m.tier } : {}),
    ...(m.techLevel != null ? { techLevel: m.techLevel } : {}),
    ...(m.cost ? { cost: m.cost } : {}),
    ...(m.actionType ? { actionType: m.actionType } : {}),
    ...(m.mechActionType ? { mechActionType: m.mechActionType } : {}),
  }
}

/** A search result's kind for a rule told inside a guide. */
const RULE_KIND = 'Rule'

/**
 * Rules the dataset gives no entry of their own, each found by its name and
 * opened where the book tells it: a guide's step. In the app's own words (a
 * stat term's, `statTerms`), so no book text is added to the index.
 */
const RULE_ROWS: readonly { name: string; text: string; guide: string; step: string }[] = [
  {
    name: TRAINING_POINTS.name,
    text: TRAINING_POINTS.text,
    guide: 'Crawler Downtime',
    step: 'Train your Pilot',
  },
]

/** `RULE_ROWS` as index rows: the rule's name, opening its guide at the step that tells it. */
function ruleEntries(): CompactSearchEntry[] {
  const schema = getEntitySchemas().find((candidate) => candidate.id === 'guides')
  return RULE_ROWS.flatMap((rule) => {
    const guide = SalvageUnionReference.Guides.getByName(rule.guide)
    const step = guide?.steps?.find((candidate) => candidate.name === rule.step)
    if (!schema || !guide || !step) return []
    const nameText = rule.name.toLowerCase()
    const aliases = searchAliases(nameText)
    return [
      {
        id: `${guide.id}:rule:${nameToSlug(rule.name)}`,
        name: rule.name,
        slug: nameToSlug(rule.name),
        schemaName: 'guides' as const,
        schemaTitle: schema.title,
        text: [rule.name, rule.text, ...aliases].join(' ').toLowerCase(),
        model: { ...rowModel(guide), title: rule.name },
        ...(aliases.length > 0 ? { aliases: [...aliases] } : {}),
        pattern: {
          // The step's anchor on its guide's page (`guideAnchors`: its name as a slug).
          href: `${itemHref('guides', getEntitySlug(guide))}#${nameToSlug(step.name)}`,
          kind: `${RULE_KIND} · ${guide.name}`,
        },
        rule: true,
      },
    ]
  })
}

export function buildSearchIndexEntries(): CompactSearchEntry[] {
  // The rules' own rows lead: on equal terms a rule's name is found before the guide that tells it.
  const entries: CompactSearchEntry[] = ruleEntries()
  // The roll tables another record prints as its own: ranked under that owner.
  // What the Roll Tables listing leaves out (`listingEntries`).
  const tables = SalvageUnionReference.RollTables.all()
  const topLevel = new Set(listingEntries('roll-tables', tables).map((table) => table.name))
  const embedded = new Set(tables.filter((t) => !topLevel.has(t.name)).map((t) => t.name))

  for (const schema of getEntitySchemas()) {
    // Runtime-validated narrowing (string catalog id → schema name) instead
    // of asserting; getEntitySchemas() only yields canonical schema ids, so
    // this never actually skips.
    if (!isSchemaName(schema.id)) continue
    const model = getModel(schema.id)
    if (!model) continue

    for (const entity of model.all()) {
      const parts: string[] = [entity.name]

      // Entity union members are object-literal types, so they satisfy the
      // implicit string index signature — an annotation, not a cast.
      const record: Record<string, unknown> = entity
      for (const field of TEXT_FIELDS) {
        const value = record[field]
        if (typeof value === 'string') parts.push(value)
      }

      if (record.content) {
        parts.push(extractContentText(record.content))
      }

      const resolvedActions = SalvageUnionReference.resolveActions(entity)
      if (resolvedActions) {
        for (const action of resolvedActions) {
          if (action && typeof action === 'object' && 'content' in action) {
            parts.push(extractContentText(action.content))
          }
        }
      }

      // A guide's steps and a roll table's results are its rules too.
      const rulesText = rulesSearchText(entity)
      if (rulesText) parts.push(rulesText)

      // A pattern is found through its host ("Hill Worm" finds Typhon).
      const patternText = patternSearchText(entity)
      if (patternText) parts.push(patternText)

      // The name as it may be typed instead: without its punctuation
      // ("biotitan"), or by an alias ("sp").
      const nameText = entity.name.toLowerCase()
      const aliases = searchAliases(nameText)
      parts.push(searchSquashedName(nameText), ...aliases)

      entries.push({
        id: entity.id,
        name: entity.name,
        slug: getEntitySlug(entity),
        schemaName: schema.id,
        schemaTitle: schema.title,
        text: parts.join(' ').toLowerCase(),
        model: rowModel(entity),
        ...(aliases.length > 0 ? { aliases: [...aliases] } : {}),
        ...(schema.id === 'roll-tables' && embedded.has(entity.name) ? { embedded: true } : {}),
      })

      // And by its own name, as a row of its own that opens its own page
      // ("Stefanus" opens the pattern, not its chassis).
      for (const pattern of getPatterns(entity as RefMetaEntity) ?? []) {
        const slug = nameToSlug(pattern.name)
        entries.push({
          id: `${entity.id}:pattern:${slug}`,
          name: pattern.name,
          slug,
          schemaName: schema.id,
          schemaTitle: schema.title,
          text: [
            pattern.name,
            searchSquashedName(pattern.name.toLowerCase()),
            PATTERN_KIND,
            extractContentText(pattern.content ?? []),
          ]
            .join(' ')
            .toLowerCase(),
          model: rowModel(entity, pattern),
          pattern: {
            href: patternHref(schema.id, getEntitySlug(entity), slug),
            kind: `${PATTERN_KIND} · ${entity.name}`,
          },
        })
      }
    }
  }

  return entries
}
