/**
 * The Stop Sign's post: what a Game's bound channel reads when someone at the
 * table shows the Stop Sign in Play, on a table that opted in
 * (`src/worker/relay.ts#handlePostStop`).
 *
 * Fixed words, never a player's: who showed it is not said, as Play does not
 * say it either, and no reason is asked for (Core Book p.13). Pure.
 */

import { DISCORD_NEUTRAL_ACCENT } from 'salvageunion-reference'
import type { ContainerData } from './container'

export function stopSignContainer(): ContainerData {
  return {
    accent: DISCORD_NEUTRAL_ACCENT,
    blocks: [
      { kind: 'text', content: '## Stop Sign: the game is paused' },
      {
        kind: 'text',
        content:
          'Someone at the table has shown the Stop Sign. Step out of character and talk it through. Nobody needs to justify it.',
      },
      { kind: 'text', content: '-# Play resumes when the table is ready.' },
    ],
  }
}
