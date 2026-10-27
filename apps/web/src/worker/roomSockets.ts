import type { DurableObject } from 'cloudflare:workers'
import type { WebSocket as RoomSocket } from '@cloudflare/workers-types'
import type { ServerMessage } from '../rooms/protocol'

/** Sending to a room's open sockets (`./rooms.ts`): never failing on one that is closing. */

type RoomState = ConstructorParameters<typeof DurableObject>[0]

/** Each open socket's own snapshot, after a change that may touch several things. */
export function snapshotEach(ctx: RoomState, snapshotOf: (member: string) => ServerMessage): void {
  const byMember = new Map<string, string>()
  for (const ws of ctx.getWebSockets()) {
    const [member] = ctx.getTags(ws)
    if (member === undefined) continue
    let text = byMember.get(member)
    if (text === undefined) {
      text = JSON.stringify(snapshotOf(member))
      byMember.set(member, text)
    }
    sendQuietly(ws as RoomSocket, text)
  }
}

/** The same messages to every open socket. */
export function sendEach(ctx: RoomState, messages: readonly ServerMessage[]): void {
  const texts = messages.map((message) => JSON.stringify(message))
  for (const ws of ctx.getWebSockets())
    for (const text of texts) sendQuietly(ws as RoomSocket, text)
}

export function sendQuietly(ws: RoomSocket, text: string): void {
  try {
    ws.send(text)
  } catch {
    // Closing as we sent; its own close handler answers the rest.
  }
}
