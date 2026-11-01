/**
 * The half of a player thing's link preview only the browser can work out:
 * the reference's names for its slugs, and the stat boxes.
 *
 * The Worker writes the unfurl's words without the reference data (it must
 * stay small); the `/og/$kind/$id` render surface loads the reference and
 * draws the same card with these filled in. Every number is the one the
 * sheet shows, from the same rules (`salvageunion-reference/rules`).
 */

import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  crawlerMaxSP,
  mechMaxSP,
  parseCrawlerTechLevel,
  resolveChassisRef,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import type { OgCardStat } from '../../components/index'
import { loadoutSlots } from '../patterns/patterns'
import type { NameOf, PreviewAnswer, PreviewCard } from './previewSummary'
import { sheetCard, titleCaseSlug } from './previewSummary'

/** A slug's name in the reference, or its words when the reference lacks it. */
export const referenceName: NameOf = (schema, slug) => {
  const entity =
    schema === 'classes'
      ? SalvageUnionReference.Classes.getBySlug(slug)
      : schema === 'chassis'
        ? SalvageUnionReference.Chassis.getBySlug(slug)
        : SalvageUnionReference.Crawlers.getBySlug(slug)
  return entity?.name ?? titleCaseSlug(schema, slug)
}

type Body = Record<string, unknown>

function num(body: Body, key: string): number | undefined {
  const value = body[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(body: Body, key: string): string | undefined {
  const value = body[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function strings(body: Body, key: string): string[] {
  const value = body[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** "current/max", the way the sheet's pools read. */
function pool(current: number | undefined, max: number): string {
  return `${resolvePool(current, max)}/${max}`
}

/** The stat boxes a player thing's card carries. */
export function previewStats(answer: PreviewAnswer): OgCardStat[] {
  const body = (answer.body ?? {}) as Body
  switch (answer.kind) {
    case 'pilot': {
      const techLevel = parseCrawlerTechLevel(answer.crawlerTechLevel)
      const crawler = techLevel === undefined ? null : { techLevel }
      const { maxHP, maxAP } = pilotMaxima(body as Pilot, crawler)
      return [
        { label: 'HP', value: pool(num(body, 'currentHP'), maxHP) },
        { label: 'AP', value: pool(num(body, 'currentAP'), maxAP) },
        { label: 'TP', value: String(num(body, 'trainingPoints') ?? 0) },
        {
          label: 'Mech',
          value: answer.mechChassisRef ? referenceName('chassis', answer.mechChassisRef) : '—',
        },
      ]
    }
    case 'mech': {
      const { maxSP, maxEP, maxHeat } = mechMaxima(body as Mech, answer.pilotAbilities, [])
      return [
        { label: 'SP', value: pool(num(body, 'currentSP'), maxSP) },
        { label: 'EP', value: pool(num(body, 'currentEP'), maxEP) },
        { label: 'Heat', value: `${resolveGauge(num(body, 'currentHeat'), maxHeat)}/${maxHeat}` },
      ]
    }
    case 'crawler': {
      const techLevel = parseCrawlerTechLevel(body.techLevel)
      const max = crawlerMaxSP({ ...(body as Parameters<typeof crawlerMaxSP>[0]), techLevel })
      return [
        { label: 'TL', value: String(techLevel ?? 1) },
        { label: 'SP', value: pool(num(body, 'currentSP'), max) },
      ]
    }
    case 'npc': {
      const max = num(body, 'hitPoints') ?? 0
      return [{ label: text(body, 'damageType') ?? 'HP', value: pool(num(body, 'currentHP'), max) }]
    }
    case 'pattern': {
      const chassis = resolveChassisRef(String(body.chassisRef ?? ''))
      if (!chassis) return []
      const systems = strings(body, 'systems')
      const modules = strings(body, 'modules')
      const slots = loadoutSlots({ chassisRef: chassis.id, systems, modules })
      return [
        { label: 'TL', value: String(chassis.techLevel) },
        { label: 'SYS', value: `${slots.systemSlotsUsed}/${slots.systemSlotsMax}` },
        { label: 'MOD', value: `${slots.moduleSlotsUsed}/${slots.moduleSlotsMax}` },
        {
          label: 'SP',
          value: String(mechMaxSP({ chassisRef: chassis.id, systems, modules }, chassis)),
        },
      ]
    }
  }
}

/** The whole card a player thing's preview draws: words, names and stats. */
export function fullSheetCard(answer: PreviewAnswer, address: string): PreviewCard {
  const card = sheetCard(answer, referenceName, address)
  return 'stats' in card ? { ...card, stats: previewStats(answer) } : card
}
