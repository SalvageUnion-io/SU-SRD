/**
 * NpcDesignerPage — `/npcs/new`, the NPC designer (issue 1277;
 * `docs/architecture/npc-builder.md`).
 *
 * **Any NPC** (board N1) on the Denizens navy band: five steps from a
 * reference template or a blank start (`AnyNpcDesigner`). The band is solid:
 * the designer is a tool, and the hatched user-made band belongs to an NPC's
 * own page (D9).
 *
 * Router-agnostic, as `NewEntityScreen` is: the route maps every change onto
 * the URL. Signed out, `NewEntityScreen` shows the sign-in panel instead.
 */

import { ChapterBand } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { AnyNpcDesigner } from './AnyNpcDesigner'
import { EYEBROW, PAGE } from './npcStyles'

type NpcDesignerPageProps = {
  /** An NPC design was saved: go to its sheet. */
  onCreated: (npcId: string) => void
  onCancel: () => void
}

export function NpcDesignerPage({ onCreated, onCancel }: NpcDesignerPageProps) {
  const { mode } = useConnection()
  const signedIn = mode === 'connected' || mode === 'disconnected'
  const me = useQuery(api.account.me, signedIn ? {} : 'skip')
  const madeBy = me?.displayName ?? 'you'

  return (
    <main style={PAGE}>
      <ChapterBand
        tone="denizen"
        measure="80rem"
        eyebrow={<p style={EYEBROW}>Denizens · New NPC</p>}
      >
        Design an NPC
      </ChapterBand>
      <AnyNpcDesigner madeBy={madeBy} onCreated={onCreated} onCancel={onCancel} />
    </main>
  )
}
