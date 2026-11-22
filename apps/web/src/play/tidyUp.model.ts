/**
 * The one tidy step between phases (r6 C2, MD6-05), pure: what a running
 * encounter leaves behind when the Mediator begins Downtime or ends the
 * session: the encounter itself, its Opposition on the field, and the Scene
 * conditions still on. Each is a box in the dialog that asks; one press does
 * all that are ticked.
 */

/**
 * The owner's ruling on the boxes' default (r6 C2): `'whenOver'`
 * (recommended) — ticked once the fight is over, every Opposition unit down;
 * `'never'` — left unticked, so nothing changes unless the Mediator ticks it.
 * The one place the ruling is kept.
 */
export const TIDY_DEFAULT: 'whenOver' | 'never' = 'whenOver'

export type TidyKey = 'encounter' | 'field' | 'scene'

export type TidyChoice = { key: TidyKey; label: string }

export type TidyWords = {
  endEncounter: (name: string) => string
  clearTheDowned: string
  clearTheField: (standing: number) => string
  endConditions: (names: string) => string
}

/** A tray row is down as the Mediator's screen reads it: unset HP is full; no maximum, never down. */
export function trayRowDown(body: unknown): boolean {
  const b = (body ?? {}) as Record<string, unknown>
  const maxHp = typeof b.maxHp === 'number' ? b.maxHp : 0
  const currentHp = typeof b.currentHp === 'number' ? b.currentHp : maxHp
  return maxHp > 0 && currentHp <= 0
}

export type TidyPlan = {
  choices: TidyChoice[]
  /** The boxes ticked when the dialog opens. */
  ticked: TidyKey[]
  /** Every Opposition unit on the field is down. */
  over: boolean
}

export function tidyPlan(
  state: {
    /** The running encounter's name; null with none running. */
    running: string | null
    /** The field's rows, each down or not (`trayRowDown`). */
    field: readonly boolean[]
    /** The Scene conditions on, by name ("Radiation Storm"); empty with none. */
    conditions: string
  },
  words: TidyWords
): TidyPlan {
  const standing = state.field.filter((down) => !down).length
  const over = state.field.length > 0 && standing === 0
  const choices: TidyChoice[] = [
    ...(state.running === null
      ? []
      : [{ key: 'encounter' as const, label: words.endEncounter(state.running) }]),
    ...(state.field.length === 0
      ? []
      : [
          {
            key: 'field' as const,
            label: over ? words.clearTheDowned : words.clearTheField(standing),
          },
        ]),
    ...(state.conditions === ''
      ? []
      : [{ key: 'scene' as const, label: words.endConditions(state.conditions) }]),
  ]
  // Nothing of a fight to tidy: the dialog asks nothing more.
  if (state.running === null && state.field.length === 0) {
    return { choices: [], ticked: [], over }
  }
  const ticked = TIDY_DEFAULT === 'whenOver' && over ? choices.map((c) => c.key) : []
  return { choices, ticked, over }
}
