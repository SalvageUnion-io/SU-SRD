/**
 * Heat Check / Reactor Overload — the app-local half. The pure math lives in
 * `salvageunion-reference/rules` (ADR-006); `heatCheckPatch` stays here: it
 * assembles a `Partial<Mech>` write-through patch using ITUN's own Zod-derived
 * `Mech` type (ADR-007: the app, not the rules package, decides what crosses
 * into durable state).
 */

import type { HeatCheckEffect } from 'salvageunion-reference/rules'
import type { Mech } from '../schemas/mech'

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
