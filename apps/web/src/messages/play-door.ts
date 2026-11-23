/**
 * The words of the door into Play (`play/sessionDoor.model.ts`, ADR-054): its
 * own catalogue, so a sheet's band, which shows only the door, does not load
 * all of Play's words.
 */

import { messages } from './define'

export const playDoorCopy = messages({
  joinSession: 'Join session',
  // One name per door (glossary §9, r3 H3): Join session while the Game's
  // session is live, else Open table, on a Game's page, its row, a pilot's
  // line and a sheet's band; the "as" forms are the accessible names.
  openTable: 'Open table',
  // A pilot in no Game (r4 C7): there is no table to open, so the door says play.
  playSolo: 'Play solo',
  playSoloAs: 'Play solo as {name}',
  joinSessionAs: 'Join session as {name}',
  openTableAs: 'Open table as {name}',
  joinSessionAsIn: 'Join session as {name} in {game}',
  openTableAsIn: 'Open table as {name} in {game}',
})
