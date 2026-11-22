/**
 * The door into Play, under one name wherever it stands (glossary §9, r3 H3):
 * **Join session** while the pilot's Game has a group session live, else
 * **Open table**. The session strip, a Game's page and its row on the Games
 * list, a pilot's line and a sheet's band all read it from here, and every
 * one of them opens the seat itself, the pilot's Play.
 *
 * A pilot in no Game has no table to open and no session to join: its door
 * reads **Play solo** (r4 C7), on its sheet and on its line.
 */

import { playCopy } from '../messages/play'

/** The door's words. */
export function sessionDoor(live: boolean, solo = false): string {
  if (solo) return playCopy('playSolo')
  return live ? playCopy('joinSession') : playCopy('openTable')
}

/** The door's accessible name where several stand together: who it seats, and in which Game. */
export function sessionDoorAs(
  live: boolean,
  pilot: string,
  game?: string | null,
  solo = false
): string {
  if (solo) return playCopy('playSoloAs', { name: pilot })
  if (game == null) return playCopy(live ? 'joinSessionAs' : 'openTableAs', { name: pilot })
  return playCopy(live ? 'joinSessionAsIn' : 'openTableAsIn', { name: pilot, game })
}
