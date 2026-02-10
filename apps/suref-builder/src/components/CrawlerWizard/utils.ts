import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefCrawler } from 'salvageunion-reference'

export type BayNPCData = {
  name: string
  notes: string
  hitPoints: number | null
  damage: number
}

export type CrawlerNPCData = {
  name: string
  notes: string
  hitPoints: number | null
  damage: number
}

export interface WizardState {
  selectedCrawlerTypeId: string | null
  bayNPCs: Record<string, BayNPCData>
  bayNPCChoices: Record<string, Record<string, string>> // bayId -> choiceId -> value
  crawlerNPC: CrawlerNPCData | null
  crawlerNPCChoices: Record<string, string>
  armamentBayWeaponId: string | null
  name: string
}

/**
 * Get all crawler types from the Workshop Manual
 */
export function getWorkshopManualCrawlers(): SURefCrawler[] {
  const allCrawlers = SalvageUnionReference.Crawlers.all()
  return allCrawlers
    .filter((crawler) => crawler.source === 'Salvage Union Workshop Manual')
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Validate if a wizard step is complete
 */
export function validateWizardStep(step: number, state: WizardState): boolean {
  switch (step) {
    case 1:
      return !!state.selectedCrawlerTypeId
    case 2:
      return !!state.armamentBayWeaponId
    case 3:
      return !!state.name.trim()
    default:
      return false
  }
}
