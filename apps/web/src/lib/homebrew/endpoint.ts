/**
 * The Worker's Homebrew endpoint (ADR-061), shared by the Worker that serves
 * it (`worker/homebrew.ts`) and the pages that read it (`./homebrew.ts`).
 * Kept apart so the Worker carries none of the reference data a page parses
 * the rows with.
 */

/** Where the Worker serves homebrew patterns: `?chassis=<ref>` narrows to one chassis. */
export const HOMEBREW_PATTERNS_PATH = '/homebrew/patterns.json'

/**
 * Whether a reader asked chassis pages to show homebrew: a per-browser
 * setting. Here, free of the reference data, so the page script can ask
 * whether the switch was left on (`runtime/mountNow.ts`).
 */
export const SHOW_HOMEBREW_KEY = 'su:show-homebrew'

/** One pattern as `homebrew.patterns` serves it. */
export type HomebrewRow = {
  appId: string
  body: unknown
  madeBy: string
  sharedAt: number | null
}

/** The address one read asks for: every pattern, or one chassis's. */
export function homebrewPatternsUrl(chassisRef?: string): string {
  return chassisRef === undefined
    ? HOMEBREW_PATTERNS_PATH
    : `${HOMEBREW_PATTERNS_PATH}?chassis=${encodeURIComponent(chassisRef)}`
}
