/**
 * The table's events, as the Game's bound channel reads them
 * (`src/worker/relay.ts#handlePostEvents`): what members did in the app, one
 * line each, a burst as one quiet message with no heading. The transport
 * pings nobody with them (`toWire`). Pure.
 */

import { EVENT_LINE_MAX, EVENTS_POST_MAX_LINES } from 'game-domain/botWire'
import { DISCORD_NEUTRAL_ACCENT } from 'salvageunion-reference'
import type { ContainerData } from './container'

/** A line as the channel prints it: one line, no Markdown of its own, within the cap. */
function printed(line: string): string {
  const flat = line
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([\\*_~`|>#])/g, '\\$1')
  return flat.length > EVENT_LINE_MAX ? `${flat.slice(0, EVENT_LINE_MAX - 1)}…` : flat
}

export function tableEventsContainer(lines: readonly string[]): ContainerData {
  const kept = lines.map(printed).filter((line) => line.length > 0)
  const shown = kept.slice(0, EVENTS_POST_MAX_LINES)
  const more = kept.length - shown.length
  return {
    accent: DISCORD_NEUTRAL_ACCENT,
    blocks: [
      {
        kind: 'text',
        content: [
          ...shown.map((line) => `-# ${line}`),
          ...(more > 0 ? [`-# and ${more} more`] : []),
        ].join('\n'),
      },
    ],
  }
}
