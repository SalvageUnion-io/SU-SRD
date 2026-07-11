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
 */

import { create } from 'zustand'

/** Which entity currently "owns" the cockpit — the active-row entity. */
export type MountState = 'mech' | 'pilot' | 'downtime'

type PlayState = {
  /** Active-row entity. Defaults to the boarded mech. */
  mount: MountState
  /** Selected index on the rotary Dial. */
  wheel: number
  setMount: (mount: MountState) => void
  setWheel: (wheel: number) => void
}

export const usePlayStateStore = create<PlayState>((set) => ({
  mount: 'mech',
  wheel: 0,
  setMount: (mount) => set({ mount }),
  setWheel: (wheel) => set({ wheel }),
}))
