/**
 * playStateStore — what is left of the Dashboard's per-device play state.
 *
 * Mount, range band and activated effects moved to the pilot's seat, saved on
 * the Game (`components/dashboard/useSeat.ts`, ADR-038 §2). What remains is
 * not persisted and resets on reload. It goes when the Dashboard follows the
 * Game's own Downtime row (docs/architecture/dashboard-redesign.md, layer 8):
 *
 *  - whether this device has entered Downtime, with the guided wizard's step
 *    (`dtStep`) and its per-step "Mark Complete" toggles (`dtDone`). Leaving
 *    Downtime returns to whatever the seat says;
 *  - the selected index on the rotary Dial;
 *  - the one-shot hand-off from the deck's Apply step to the band's Take
 *    Damage overlay.
 */

import { create } from 'zustand'

type PlayState = {
  /** True while this device is in Downtime: the crawler runs the Dashboard. */
  downtime: boolean
  /** Selected index on the rotary Dial. */
  wheel: number
  /** Current step index in the Downtime wizard (0-based). */
  dtStep: number
  /** Per-step "Mark Complete" toggles, keyed by step index (ephemeral). */
  dtDone: Record<number, boolean>
  /** One-shot signal: the deck's Apply step armed a destructive outcome, so the
   *  active Item band should open its Take-Damage overlay (pre-armed) for the
   *  player to confirm. Consumed (reset) by the band once it opens the overlay. */
  damagePromptArmed: boolean
  setWheel: (wheel: number) => void
  /** Arm the destructive-outcome hand-off (deck Apply → active band overlay). */
  armDamagePrompt: () => void
  /** Consume the destructive-outcome signal (band opened its overlay). */
  consumeDamagePrompt: () => void
  /** Enter Downtime at the wizard's first step. */
  enterDowntime: () => void
  /** Leave Downtime; the seat decides what runs the Dashboard again. */
  leaveDowntime: () => void
  /** Move the Downtime wizard to a step index. */
  setDtStep: (step: number) => void
  /** Toggle the "Mark Complete" flag for a Downtime step index. */
  toggleDtDone: (step: number) => void
}

export const usePlayStateStore = create<PlayState>((set) => ({
  downtime: false,
  wheel: 0,
  dtStep: 0,
  dtDone: {},
  damagePromptArmed: false,
  setWheel: (wheel) => set({ wheel }),
  armDamagePrompt: () => set({ damagePromptArmed: true }),
  consumeDamagePrompt: () => set({ damagePromptArmed: false }),
  enterDowntime: () => set((s) => (s.downtime ? s : { downtime: true, dtStep: 0, dtDone: {} })),
  leaveDowntime: () => set({ downtime: false }),
  setDtStep: (step) => set({ dtStep: step }),
  toggleDtDone: (step) => set((s) => ({ dtDone: { ...s.dtDone, [step]: !s.dtDone[step] } })),
}))
