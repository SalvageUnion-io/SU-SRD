/**
 * What a pilot is called, everywhere a player reads one (glossary.md §14):
 * the callsign, `GHOST`, else the name for an older pilot that has none (r8
 * F1). The optional Name is shown only on the pilot's own sheet, beside the
 * callsign; nothing else joins the two.
 *
 * The one place a pilot is named: the Training Bay, the wizards, menus,
 * toasts, downloads, a Game's Crew, Play, the rooms' rosters and proposals and
 * the bot's cards all read it, so a pilot never goes by one name in a list and
 * another on a seat. The `noInlinePilotName` lint rule holds the app to it.
 */

/** A pilot as far as naming one goes: a parsed pilot, or a room's opaque body. */
type Named = { callsign?: unknown; name?: unknown }

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The callsign, else the name; null when the body names nobody. */
export function pilotLabelOf(pilot: Named | null | undefined): string | null {
  return text(pilot?.callsign) || text(pilot?.name) || null
}

/** The callsign, else the name; "Pilot" for one with neither. */
export function pilotLabel(pilot: Named | null | undefined): string {
  return pilotLabelOf(pilot) ?? 'Pilot'
}

/** The same name where a line has room for one word (a door: "Play GHOST"). */
export const pilotCallsign = pilotLabel
