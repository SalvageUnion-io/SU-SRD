/**
 * "Copy invite link" — the one way a Game is shared (issue 1255). It sits on the
 * Game page and on the Dashboard's Crew tab (board D2).
 *
 * The link is the Game's standing link for whoever presses it
 * (`invites.link`): the Organizer's opens the door, anyone else's asks the
 * Organizer to let the newcomer in. Pressing it again copies the same link.
 *
 * Connected only. The link comes from the server of record, so a signed-out or
 * offline viewer has nothing to copy and sees no button.
 */

import { Button, toast } from 'component-lib'
import { useMutation } from 'convex/react'
import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { inviteUrl } from '../../lib/games/inviteLink'
import { failureMessage } from '../shared/useConfirm'

type CopyInviteLinkProps = {
  gameId: Id<'games'>
  /** Injectable clipboard writer for testing. Takes the URL as a promise. */
  clipboardWriter?: (text: Promise<string>) => Promise<void>
}

/**
 * WebKit (Safari and every iOS browser) allows a clipboard write only inside
 * the user's gesture, and the invite token arrives over the Convex socket after
 * it has expired. So the clipboard gets a promise inside the gesture
 * (`ClipboardItem` accepts one); engines without it fall back to `writeText`.
 */
async function writeClipboardPromise(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((t) => new Blob([t], { type: 'text/plain' }))
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
    return
  }
  await navigator.clipboard.writeText(await text)
}

function ConnectedCopyInviteLink({
  gameId,
  clipboardWriter = writeClipboardPromise,
}: CopyInviteLinkProps) {
  const link = useMutation(api.invites.link)
  const [busy, setBusy] = useState(false)

  async function copy(): Promise<void> {
    setBusy(true)
    try {
      const url = link({ gameId }).then((token) => inviteUrl(window.location.origin, token))
      await clipboardWriter(url)
      toast.success('Invite link copied', { id: 'invite-link-copy', duration: 2000 })
    } catch (err) {
      toast.error(failureMessage(err, 'The invite link could not be copied. Try again.'), {
        id: 'invite-link-copy',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="default" size="compact" disabled={busy} onClick={() => void copy()}>
      <Link2 aria-hidden="true" size={16} />
      Copy invite link
    </Button>
  )
}

export function CopyInviteLink(props: CopyInviteLinkProps) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedCopyInviteLink {...props} />
}
