/**
 * The half of a player thing's link preview only the browser can work out
 * (issue 1280): the reference's names for its slugs, and the stat boxes.
 *
 * The Worker writes the unfurl's words without the reference data (it must
 * stay small); the `/og/$kind/$id` render surface loads the reference and
 * draws the same card with these filled in. Every number is the one the
 * sheet shows, from the same rules (`salvageunion-reference/rules`).
 */
import type { OgCardStat } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  crawlerMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
  resolveChassisRef,
  resolveModuleRef,
  resolvePool,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { slotsUsed } from '../patterns/patterns'
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
      const input = body as Parameters<typeof pilotMaxHP>[0]
      return [
        { label: 'HP', value: pool(num(body, 'currentHP'), pilotMaxHP(input)) },
        { label: 'AP', value: pool(num(body, 'currentAP'), pilotMaxAP(input)) },
        { label: 'TP', value: String(num(body, 'currentTP') ?? 0) },
        {
          label: 'Mech',
          value: answer.mechChassisRef ? referenceName('chassis', answer.mechChassisRef) : '—',
        },
      ]
    }
    case 'mech': {
      const chassis = resolveChassisRef(String(body.chassisRef ?? ''))
      const input = body as Parameters<typeof mechMaxSP>[0]
      return [
        { label: 'SP', value: pool(num(body, 'currentSP'), mechMaxSP(input, chassis)) },
        { label: 'EP', value: pool(num(body, 'currentEP'), mechMaxEP(input, chassis)) },
        { label: 'Heat', value: `${num(body, 'currentHeat') ?? 0}/${mechMaxHeat(input, chassis)}` },
      ]
    }
    case 'crawler': {
      const max = crawlerMaxSP(body as Parameters<typeof crawlerMaxSP>[0])
      return [
        { label: 'TL', value: String(body.techLevel ?? 1) },
        { label: 'SP', value: pool(num(body, 'currentSP'), max) },
      ]
    }
    case 'pattern': {
      const chassis = resolveChassisRef(String(body.chassisRef ?? ''))
      if (!chassis) return []
      const systems = strings(body, 'systems').flatMap((ref) => resolveSystemRef(ref) ?? [])
      const modules = strings(body, 'modules').flatMap((ref) => resolveModuleRef(ref) ?? [])
      return [
        { label: 'TL', value: String(chassis.techLevel) },
        { label: 'SYS', value: `${slotsUsed(systems)}/${chassis.systemSlots ?? 0}` },
        { label: 'MODS', value: `${slotsUsed(modules)}/${chassis.moduleSlots ?? 0}` },
        { label: 'SP', value: String(chassis.structurePoints ?? 0) },
      ]
    }
  }
}

/** The whole card a player thing's preview draws: words, names and stats. */
export function fullSheetCard(answer: PreviewAnswer, address: string): PreviewCard {
  const card = sheetCard(answer, referenceName, address)
  return 'stats' in card ? { ...card, stats: previewStats(answer) } : card
}
