/**
 * Crawler wizard form-state contract + entity mappers (plan 3.1).
 *
 * CrawlerWizardFormState is the layout-agnostic seam between the wizard UI
 * and the persisted Crawler entity:
 *   - `crawlerToFormState` maps a stored crawler onto initial wizard state
 *     (edit-mode prefill — greenfield per plan 3.1).
 *   - `crawlerFormToCreateInput` builds the create() payload (seeded bays,
 *     full SP for the tech level).
 *   - `crawlerFormToUpdatePatch` builds the update() patch for the upsert
 *     branch. It contains ONLY wizard-owned fields — live-play state
 *     (crawlerBays + NPC state, bayChoices, currentSP, cargoLots,
 *     maxSpModifier, workspaceId, …) is never clobbered by an edit pass.
 *
 * All functions are pure over their inputs — no store, no React. The only
 * exception is `seedDefaultCrawlerBays`, which reads the SRD bay catalog.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { Crawler, ScrapPool } from '../schemas/crawler'
import { parseCrawlerTechLevel } from '../crawlerLevel'

export type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/** Scrap-pool form shape: every TL bucket present (zeros allowed). */
export type ScrapPoolForm = Required<ScrapPool>

export const EMPTY_SCRAP_POOL: ScrapPoolForm = {
  tl1: 0,
  tl2: 0,
  tl3: 0,
  tl4: 0,
  tl5: 0,
  tl6: 0,
}

/** Shape of form state carried through the crawler wizard. */
export type CrawlerWizardFormState = {
  name: string
  /** Numeric tech level 1–6; null until chosen. */
  techLevel: number | null
  /** Installed system ids. */
  systems: string[]
  /** Shared party scrap pool, TL-bucketed (rules C5). */
  scrapPool: ScrapPoolForm
  /** Upgrade Pool progress (rules C4). */
  upgradePool: number
}

export const EMPTY_CRAWLER_FORM_STATE: CrawlerWizardFormState = {
  name: '',
  techLevel: null,
  systems: [],
  scrapPool: { ...EMPTY_SCRAP_POOL },
  upgradePool: 0,
}

/** Maps a stored crawler onto wizard initial state (edit-mode prefill). */
export function crawlerToFormState(crawler: Crawler): CrawlerWizardFormState {
  return {
    name: crawler.name,
    techLevel: parseCrawlerTechLevel(crawler.techLevel) ?? null,
    systems: [...crawler.systems],
    scrapPool: { ...EMPTY_SCRAP_POOL, ...(crawler.scrapPool ?? {}) },
    upgradePool: crawler.upgradePool ?? 0,
  }
}

/**
 * Normalizes the form's scrap pool for persistence: zero buckets are
 * stripped (the schema reads absent buckets as 0).
 */
export function toScrapPoolPatch(pool: ScrapPoolForm): ScrapPool {
  const out: ScrapPool = {}
  for (const key of ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const) {
    if (pool[key] > 0) out[key] = pool[key]
  }
  return out
}

/** Wizard-owned crawler fields — the only fields an edit save may touch. */
export type CrawlerWizardPatch = Pick<
  Crawler,
  'name' | 'techLevel' | 'systems' | 'scrapPool' | 'upgradePool'
>

export function crawlerFormToUpdatePatch(form: CrawlerWizardFormState): CrawlerWizardPatch {
  if (form.techLevel === null) {
    throw new Error('Cannot build a crawler patch without a tech level')
  }
  return {
    name: form.name.trim(),
    techLevel: `tech-${form.techLevel}`,
    systems: form.systems,
    // Always present in the patch so buckets can be zeroed out on edit.
    scrapPool: toScrapPoolPatch(form.scrapPool),
    upgradePool: form.upgradePool,
  }
}

/**
 * Build the default crawler-bay set seeded onto every new crawler.
 *
 * The official crawler sheets pre-print all SRD bays as fixed sections, so a
 * fresh crawler installs the full catalog. Each entry seeds the embedded NPC's
 * current HP from the bay's `npc.hitPoints` (4). The array is extensible — a
 * crawler can gain more bays later.
 */
export function seedDefaultCrawlerBays(): CrawlerBayEntry[] {
  type BayWithNpc = { id: string; npc?: { hitPoints?: number } }
  let bays: BayWithNpc[]
  try {
    bays = SalvageUnionReference.CrawlerBays.all() as unknown as BayWithNpc[]
  } catch {
    bays = []
  }
  return bays.map((bay) => {
    const maxHP = bay.npc?.hitPoints
    return {
      bayRef: bay.id,
      ...(typeof maxHP === 'number' ? { npcCurrentHP: maxHP } : {}),
    }
  })
}

/**
 * Create payload for a fresh crawler: seeded SRD bay set, full SP for the
 * tech level, and the starting resources from the Identity step.
 */
export function crawlerFormToCreateInput(
  form: CrawlerWizardFormState,
  opts: {
    /** Max SP for the chosen tech level — fresh crawlers start at full SP. */
    maxSP?: number
    /** Seeded bay entries (pass `seedDefaultCrawlerBays()`). */
    crawlerBays: CrawlerBayEntry[]
  }
) {
  return {
    schemaVersion: 1 as const,
    ...crawlerFormToUpdatePatch(form),
    crawlerBays: opts.crawlerBays,
    ...(opts.maxSP !== undefined ? { currentSP: opts.maxSP } : {}),
  }
}
