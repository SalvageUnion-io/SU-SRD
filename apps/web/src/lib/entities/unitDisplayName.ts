/**
 * What a unit is called wherever a player reads it outside its own sheet's
 * heading: a menu, a toast, a landmark, a download's file name, a Related
 * units card, a door (glossary §14, r8 F1). A pilot goes by its callsign
 * (`pilotLabelOf`); its optional Name shows only on its sheet, beside it. Any
 * other unit by its name.
 */
import { pilotLabelOf } from 'game-domain/pilotLabel'

/** The callsign for a pilot (it has a `callsign` field), else the unit's name. */
export function unitDisplayName(unit: {
  readonly name: string
  readonly callsign?: unknown
}): string {
  return ('callsign' in unit ? pilotLabelOf(unit) : null) ?? unit.name
}
