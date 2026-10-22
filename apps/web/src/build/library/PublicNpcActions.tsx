/**
 * PublicNpcActions — a shared NPC's page corner (`/p/npc/:appId`): Make a
 * copy, signed in, as a shared pattern's page has always offered, and, while
 * it is in the Homebrew library, Report and a site admin's Hide
 * (`LibraryPageControls`, ADR-056).
 */

import type { Npc } from 'game-domain/schemas/npc'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, toast, tokens } from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { serverMessage } from '../../lib/connection/serverError'
import { LibraryPageControls } from './LibraryPageControls'
import { copyNpc } from './libraryCopy.model'

const ACTIONS = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

export function PublicNpcActions({ npc }: { npc: Npc }) {
  const { mode, canWrite } = useConnection()
  const [busy, setBusy] = useState(false)
  if (!(canWrite && mode === 'connected')) return null

  async function copy() {
    setBusy(true)
    try {
      const name = await copyNpc(npc)
      toast.success(`Copied ${name} to your Training Bay.`)
    } catch (err) {
      toast.error(serverMessage(err) ?? 'The NPC could not be copied. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={ACTIONS}>
      <Button className="su-page-action" onClick={() => void copy()} disabled={busy}>
        {busy ? 'Copying…' : 'Make a copy'}
      </Button>
      <LibraryPageControls kind="npc" appId={npc.id} name={npc.name} />
    </div>
  )
}
