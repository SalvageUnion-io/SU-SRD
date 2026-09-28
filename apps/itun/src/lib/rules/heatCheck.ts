/**
 * Heat Check / Reactor Overload rules (Slice C, #199).
 *
 * The pure math (clampHeat, reactorOverloadOutcome, performHeatCheck,
 * performPush) moved to packages/salvageunion-reference/lib/rules/heatCheck.ts
 * (ADR-006). `heatCheckPatch` stays app-local: it assembles a `Partial<Mech>`
 * write-through patch using ITUN's own Zod-derived `Mech` type (ADR-007: the
 * app, not the rules package, decides what crosses into durable state).
 */

import type { Mech } from '../schemas/mech'

export type { HeatCheckEffect, PushResult, Roll } from 'salvageunion-reference/rules'
export {
  clampHeat,
  performHeatCheck,
  performPush,
  reactorOverloadOutcome,
} from 'salvageunion-reference/rules'

import type { HeatCheckEffect } from 'salvageunion-reference/rules'

/**
 * The single write-path mapping from a resolved Heat Check effect to the mech
 * patch (ADR-007: deterministic bookkeeping auto-applies; destructive picks
 * stay player calls). Shared by HeatCheckControl and the quick-roll FAB's Push
 * so the reactor-overload bookkeeping can't drift between the two surfaces.
 * `currentHeat`, when provided, is persisted alongside the result.
 */
export function heatCheckPatch(effect: HeatCheckEffect, currentHeat?: number): Partial<Mech> {
  const patch: Partial<Mech> = { lastHeatCheck: effect.result }
  if (currentHeat !== undefined) {
    patch.currentHeat = currentHeat
  }
  if (effect.shutdown) {
    patch.shutdown = true
    patch.vulnerable = true
    patch.currentSP = effect.nextSP
  }
  if (effect.destroyed) {
    patch.destroyed = true
  }
  return patch
}
