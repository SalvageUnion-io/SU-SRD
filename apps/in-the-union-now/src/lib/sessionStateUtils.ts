// Session state JSONB shape — strict policy: only these three keys ever go here.
export type SessionState = {
  round_number: number
  initiative_winner: 'players' | 'npcs' | null
  active_encounter_id: string | null
}

/** Returns the zero-value SessionState for a new session. */
export function defaultSessionState(): SessionState {
  return {
    round_number: 0,
    initiative_winner: null,
    active_encounter_id: null,
  }
}

/**
 * Shallow-merges a patch onto the existing session state.
 * If existing is null, starts from defaultSessionState().
 * Clamps round_number to a minimum of 0.
 */
export function mergeSessionState(
  existing: SessionState | null,
  patch: Partial<SessionState>
): SessionState {
  const base = existing ?? defaultSessionState()
  const merged = { ...base, ...patch }
  // Clamp round_number — never below 0
  merged.round_number = Math.max(0, merged.round_number)
  return merged
}
