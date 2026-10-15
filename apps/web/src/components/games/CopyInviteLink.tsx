/**
 * The Game's invite URL, the Organizer's: "Copy invite link" (the Game page
 * and the Dashboard's Crew tab, board D2) and "Reset link" (the Game page).
 *
 * Copying hands out the Game's one URL (`invites.link`); pressing it again
 * copies the same one. Resetting mints a new URL (`invites.reset`), and the
 * old one stops working, after a confirm.
 *
 * Connected only. The link comes from the server of record, so a signed-out or
 * offline viewer has nothing to copy and sees no button.
 */

import { useMutation } from 'convex/react'
import { Link2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { appRoot } from '../../lib/appUrl'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { inviteUrl } from '../../lib/games/inviteLink'
import { Button, ConfirmDialog, toast } from '../index'

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

function ConnectedResetInviteLink({ gameId }: { gameId: Id<'games'> }) {
  const reset = useMutation(api.invites.reset)
  const [confirming, setConfirming] = useState(false)

  async function run(): Promise<void> {
    await reset({ gameId })
    toast.success('Invite link reset. The old link no longer works.', {
      id: 'invite-link-reset',
    })
  }

  return (
    <>
      <Button variant="default" size="compact" onClick={() => setConfirming(true)}>
        Reset link
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title="Reset the invite link?"
        body="The current link stops working. Anyone who has it but has not joined yet needs the new one."
        confirmLabel="Reset link"
        pendingLabel="Resetting…"
        onConfirm={run}
      />
    </>
  )
}

/** "Reset link": a new invite URL, and the old one stops working. Connected only. */
export function ResetInviteLink({ gameId }: { gameId: Id<'games'> }) {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedResetInviteLink gameId={gameId} />
}
