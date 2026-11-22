/**
 * The Game's invite URL, the Organizer's, on the Game page: "Copy invite
 * link" and "Reset link", chips on the Invite link section's head.
 *
 * Copying hands out the Game's one URL (`invites.link`); pressing it again
 * copies the same one. Where the clipboard refuses, the link is shown in a
 * field, selected, to copy by hand (r5 C15). Resetting mints a new URL (`invites.reset`), and the
 * old one stops working, after a confirm.
 *
 * Connected only. The link comes from the server of record, so a signed-out or
 * offline viewer has nothing to copy and sees no button.
 */

import { Link2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { ConfirmDialog, CopiedIcon, CopiedStatus, useCopied } from '../../components/app'
import { Button, Input, toast, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { inviteUrl } from '../../lib/games/inviteLink'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

type CopyInviteLinkProps = {
  gameId: string
  /** Injectable clipboard writer for testing. Takes the URL as a promise. */
  clipboardWriter?: (text: Promise<string>) => Promise<void>
}

/**
 * WebKit (Safari and every iOS browser) allows a clipboard write only inside
 * the user's gesture, and the invite token arrives over the room's socket after
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

/** The link to copy by hand: the actions' whole line, under the buttons. */
const BY_HAND = { flexBasis: '100%' } satisfies CSSProperties

function ConnectedCopyInviteLink({
  gameId,
  clipboardWriter = writeClipboardPromise,
}: CopyInviteLinkProps) {
  const link = useGamesCall('invites.link')
  // The URL the last press fetched, and the one shown when the clipboard refused it.
  const fetched = useRef<string | null>(null)
  const [byHand, setByHand] = useState<string | null>(null)
  // Both calls start inside the press: the action runs synchronously up to its
  // first await, which is what keeps WebKit's gesture alive for the clipboard.
  const copyLink = useServerAction(
    () => {
      const url = link({ gameId }).then((token) => inviteUrl(token))
      url.then(
        (u) => {
          fetched.current = u
        },
        () => undefined
      )
      return clipboardWriter(url)
    },
    { failure: playGamesCopy('inviteLinkCopyFailed'), toastId: 'invite-link-copy' }
  )

  // Copied is the control's own Check swap and a polite status, never a toast
  // (chrome K5); a failure still toasts, from `useServerAction`.
  const { copied, flash } = useCopied()

  async function copy(): Promise<void> {
    fetched.current = null
    const result = await copyLink.run()
    if (result.ok) flash()
    setByHand(result.ok ? null : fetched.current)
  }

  return (
    <>
      <Button size="compact" disabled={copyLink.pending} onClick={() => void copy()}>
        <CopiedIcon
          copied={copied}
          size="compact"
          icon={<Link2 aria-hidden="true" size={tokens.iconSize.compact} />}
        />
        {playGamesCopy('copyInviteLink')}
      </Button>
      <CopiedStatus copied={copied} />
      {byHand !== null && (
        <div style={BY_HAND}>
          <Input
            readOnly
            autoFocus
            aria-label={playGamesCopy('inviteLink')}
            value={byHand}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </>
  )
}

export function CopyInviteLink(props: CopyInviteLinkProps) {
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedCopyInviteLink {...props} />
}

function ConnectedResetInviteLink({ gameId }: { gameId: string }) {
  const reset = useGamesCall('invites.reset')
  const [confirming, setConfirming] = useState(false)

  async function run(): Promise<void> {
    await reset({ gameId })
    toast.success(playGamesCopy('inviteLinkResetTheOld'), {
      id: 'invite-link-reset',
    })
  }

  return (
    <>
      <Button size="compact" onClick={() => setConfirming(true)}>
        {playGamesCopy('resetLink')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={playGamesCopy('resetTheInviteLink')}
        body={playGamesCopy('theCurrentLinkStopsWorking')}
        confirmLabel={playGamesCopy('resetLink')}
        pendingLabel={playGamesCopy('resetting')}
        onConfirm={run}
      />
    </>
  )
}

/** "Reset link": a new invite URL, and the old one stops working. Connected only. */
export function ResetInviteLink({ gameId }: { gameId: string }) {
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedResetInviteLink gameId={gameId} />
}
