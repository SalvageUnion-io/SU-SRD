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
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { appRoot } from '../../lib/appUrl'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { inviteUrl } from '../../lib/games/inviteLink'

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
  // Both calls start inside the press: the action runs synchronously up to its
  // first await, which is what keeps WebKit's gesture alive for the clipboard.
  const copyLink = useServerAction(
    () => clipboardWriter(link({ gameId }).then((token) => inviteUrl(appRoot(), token))),
    { failure: 'The invite link could not be copied. Try again.', toastId: 'invite-link-copy' }
  )

  async function copy(): Promise<void> {
    const result = await copyLink.run()
    if (result.ok) toast.success('Invite link copied', { id: 'invite-link-copy', duration: 2000 })
  }

  return (
    <Button
      variant="default"
      size="compact"
      disabled={copyLink.pending}
      onClick={() => void copy()}
    >
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
