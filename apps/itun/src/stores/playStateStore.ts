/**
 * playStateStore — EPHEMERAL cockpit play-state (Play Cockpit / "Pit HUD").
 *
 * This is deliberately NOT persisted and NOT an IndexedDB collection: the mount
 * state machine (which entity is "active" — mech boarded / pilot on foot /
 * downtime) and the dial focus are a *play-session* concern, never character
 * data. Keeping them out of the entity schemas prevents them leaking into live
 * sheets or shared snapshots (see docs/architecture/play-cockpit.md, proposed
 * ADR-019). It resets on reload — that is intended.
 *
 * Phase 1 (read-only shell) tracks only the mount state and dial index; later
 * phases extend it (range band, push-armed, overlays, dial config, etc.).
 *
 * Phase 6 (Downtime) adds the crawler-dominant `'downtime'` mode: entering it
 * remembers the prior mount (`priorMount`) so Leave restores it, and it carries
 * the guided Downtime wizard's ephemeral progress (`dtStep` + the per-step
 * `dtDone` "Mark Complete" toggles). None of this is persisted — Downtime
 * *effects* land on the entity sheets, but the wizard's cursor is play-state.
 */

import { create } from 'zustand'

import type { RangeBand } from '../components/dashboard/dashboardRules'

/** Which entity currently "owns" the cockpit — the active-row entity. */
export type MountState = 'mech' | 'pilot' | 'downtime'

type PlayState = {
  /** Active-row entity. Defaults to the on-foot pilot (a fresh dashboard opens
   *  in pilot mode, not boarded). */
  mount: MountState
  /** Selected index on the rotary Dial. */
  wheel: number
  /** Self-declared engagement range band for the Actions deck (ephemeral). */
  range: RangeBand
  /** The mount to restore when leaving Downtime (null when not in Downtime). */
  priorMount: MountState | null
  /** Current step index in the Downtime wizard (0-based). */
  dtStep: number
  /** Per-step "Mark Complete" toggles, keyed by step index (ephemeral). */
  dtDone: Record<number, boolean>
  /** One-shot signal: the deck's Apply step armed a destructive outcome, so the
   *  active Item band should open its Take-Damage overlay (pre-armed) for the
   *  player to confirm. Consumed (reset) by the band once it opens the overlay. */
  damagePromptArmed: boolean
  /**
   * Which `duration: 'activated'` contributions are switched on, keyed by the
   * declaring record's ref (ADR-029 / F1).
   *
   * **Manual expiry by design.** Salvage Union states real durations ("this
   * effect lasts for 1 hour"), but the app has no play clock and inventing one
   * would put wall-time into the data layer and make a sheet's numbers change
   * while nobody is looking. The table keeps time; the app keeps state — the
   * same division ADR-001's honour system already relies on.
   *
   * Ephemeral like the rest of this store: an activated effect never persists
   * onto the entity, so it can never leak into a live sheet or a shared
   * snapshot (ADR-019).
   */
  activeEffects: Record<string, boolean>
  setMount: (mount: MountState) => void
  /** Switch an activated contribution on or off. */
  toggleEffect: (ref: string) => void
  setWheel: (wheel: number) => void
  /** Set the self-declared engagement range band. */
  setRange: (range: RangeBand) => void
  /** Arm the destructive-outcome hand-off (deck Apply → active band overlay). */
  armDamagePrompt: () => void
  /** Consume the destructive-outcome signal (band opened its overlay). */
  consumeDamagePrompt: () => void
  /** Enter Downtime, remembering the current mount to restore on Leave. */
  enterDowntime: () => void
  /** Leave Downtime, restoring the mount active when it was entered. */
  leaveDowntime: () => void
  /** Move the Downtime wizard to a step index. */
  setDtStep: (step: number) => void
  /** Toggle the "Mark Complete" flag for a Downtime step index. */
  toggleDtDone: (step: number) => void
}

export const usePlayStateStore = create<PlayState>((set) => ({
  mount: 'pilot',
  wheel: 0,
  range: 'Close',
  priorMount: null,
  dtStep: 0,
  dtDone: {},
  damagePromptArmed: false,
  activeEffects: {},
  setMount: (mount) => set({ mount }),
  toggleEffect: (ref) =>
    set((s) => ({ activeEffects: { ...s.activeEffects, [ref]: !s.activeEffects[ref] } })),
  setWheel: (wheel) => set({ wheel }),
  setRange: (range) => set({ range }),
  armDamagePrompt: () => set({ damagePromptArmed: true }),
  consumeDamagePrompt: () => set({ damagePromptArmed: false }),
  enterDowntime: () =>
    set((s) =>
      s.mount === 'downtime' ? s : { mount: 'downtime', priorMount: s.mount, dtStep: 0, dtDone: {} }
    ),
  leaveDowntime: () => set((s) => ({ mount: s.priorMount ?? 'mech', priorMount: null })),
  setDtStep: (step) => set({ dtStep: step }),
  toggleDtDone: (step) => set((s) => ({ dtDone: { ...s.dtDone, [step]: !s.dtDone[step] } })),
}))
