/**
 * What a pilot is called, everywhere a player reads one (glossary.md §14):
 * the callsign first, then the name, `GHOST · Mara Voss`. One of the two
 * alone when the other is missing or only repeats it (a Starter Set pilot's
 * callsign is their name).
 *
 * The one place the two fields are joined: the Training Bay, a Game's Crew,
 * Play, the rooms' rosters and proposals and the bot's cards all read it, so
 * a pilot never goes by one name in a list and another on a seat. The
 * `noInlinePilotName` lint rule holds the app to it.
 */

/** A pilot as far as naming one goes: a parsed pilot, or a room's opaque body. */
type Named = { callsign?: unknown; name?: unknown }

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** `CALLSIGN · Name`, or whichever one there is; null when the body names nobody. */
export function pilotLabelOf(pilot: Named | null | undefined): string | null {
  const callsign = text(pilot?.callsign)
  const name = text(pilot?.name)
  if (callsign === '') return name === '' ? null : name
  if (name === '' || name.toLowerCase() === callsign.toLowerCase()) return callsign
  return `${callsign} · ${name}`
}

/** `CALLSIGN · Name` for a pilot that has a name of some kind; "Pilot" for one with neither. */
export function pilotLabel(pilot: Named | null | undefined): string {
  return pilotLabelOf(pilot) ?? 'Pilot'
}

/** The short form where a line has room for one word (a door: "Play GHOST"): the callsign, else the name. */
export function pilotCallsign(pilot: Named | null | undefined): string {
  return text(pilot?.callsign) || text(pilot?.name) || 'Pilot'
}
