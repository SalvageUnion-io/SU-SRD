/**
 * The Mediator's alert to the table (Tell the table in Play), as the Game's
 * bound channel reads it (`src/worker/relay.ts#handlePostAlert`): the
 * Mediator's own words, under a fixed heading. The transport pings nobody with
 * them (`toWire`). Pure.
 */

import { ALERT_POST_MAX } from 'game-domain/botWire'
import { DISCORD_NEUTRAL_ACCENT } from 'salvageunion-reference'
import type { ContainerData } from './container'

export function tableAlertContainer(message: string): ContainerData {
  const text = message.trim()
  const words = text.length > ALERT_POST_MAX ? `${text.slice(0, ALERT_POST_MAX - 1)}…` : text
  return {
    accent: DISCORD_NEUTRAL_ACCENT,
    blocks: [
      { kind: 'text', content: '## From the Mediator' },
      { kind: 'text', content: words },
    ],
  }
}
