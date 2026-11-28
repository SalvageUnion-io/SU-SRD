/**
 * The Game's invite URL, the Organizer's, on the Game page: the link itself
 * as text, "Copy invite link", "Share invite link" on a phone, and "Reset
 * link", in the Invite link section (r8 C7).
 *
 * Copying hands out the Game's one URL (`invites.link`); pressing it again
 * copies the same one. Where the clipboard refuses, the link is on show to
 * select and copy by hand (r5 C15, SB8-21). Resetting mints a new URL (`invites.reset`), and the
 * old one stops working, after a confirm.
 *
 * Connected only. The link comes from the server of record, so a signed-out or
 * offline viewer has nothing to copy and sees no button.
 */

import { Link2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { ConfirmDialog, CopiedIcon, CopiedStatus, useCopied } from '../../components/app'
import { Button, Text, toast, tokens } from '../../components/index'
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

/** The link as text, its own line over the buttons, wrapping anywhere and selected whole. */
const LINK_TEXT = {
  flexBasis: '100%',
  overflowWrap: 'anywhere',
  userSelect: 'all',
} satisfies CSSProperties

/**
 * A device's share sheet, where it has one worth opening: a touch screen's
 * (as a reference page's SHARE, `lib/sharePage.ts`); a desktop copies.
 */
function shareSheet(): ((data: ShareData) => Promise<void>) | undefined {
  const coarse = globalThis.matchMedia?.('(pointer:coarse)').matches ?? false
  return coarse && typeof navigator.share === 'function'
    ? (data) => navigator.share(data)
    : undefined
}

type InviteLinkProps = CopyInviteLinkProps & {
  /** Injectable share sheet for testing; the device's own otherwise. */
  share?: ((data: ShareData) => Promise<void>) | undefined
}

/**
 * The invite link on show, with Copy beside it, Share on a phone, and Reset
 * (r8 C7, SB8-21): where the clipboard refuses, the link is already there to
 * select. It is read as the panel opens (`invites.link`, the same URL every
 * time), and a reset shows the new one.
 */
function ConnectedInviteLink({
  gameId,
  clipboardWriter = writeClipboardPromise,
  share = shareSheet(),
}: InviteLinkProps) {
  const link = useGamesCall('invites.link')
  const [url, setUrl] = useState<string | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per Game; `link` is a fresh closure each render
  useEffect(() => {
    let live = true
    link({ gameId }).then(
      (token) => {
        if (live) setUrl(inviteUrl(token))
      },
      // Unread, Copy still fetches it on the press.
      () => undefined
    )
    return () => {
      live = false
    }
  }, [gameId])
  // Inside the press, as WebKit's gesture needs: the URL on show, else fetched.
  const copyLink = useServerAction(
    () =>
      clipboardWriter(
        url !== null ? Promise.resolve(url) : link({ gameId }).then((t) => inviteUrl(t))
      ),
    { failure: playGamesCopy('inviteLinkCopyFailed'), toastId: 'invite-link-copy' }
  )

  // Copied is the control's own Check swap and a polite status, never a toast
  // (chrome K5); a failure still toasts, from `useServerAction`.
  const { copied, flash } = useCopied()

  async function copy(): Promise<void> {
    const result = await copyLink.run()
    if (result.ok) flash()
  }

  return (
    <>
      {url !== null && (
        <Text variant="note" style={LINK_TEXT}>
          {url}
        </Text>
      )}
      <Button size="compact" disabled={copyLink.pending} onClick={() => void copy()}>
        <CopiedIcon
          copied={copied}
          size="compact"
          icon={<Link2 aria-hidden="true" size={tokens.iconSize.compact} />}
        />
        {playGamesCopy('copyInviteLink')}
      </Button>
      <CopiedStatus copied={copied} />
      {share !== undefined && url !== null && (
        <Button
          size="compact"
          onClick={() =>
            // Closing the sheet unshared is no failure.
            void share({ url }).catch(() => undefined)
          }
        >
          {playGamesCopy('shareInviteLink')}
        </Button>
      )}
      <ConnectedResetInviteLink gameId={gameId} onReset={setUrl} />
    </>
  )
}

/** The Organiser's invite link: on show, Copy, Share on a phone, and Reset. Connected only. */
export function InviteLink(props: InviteLinkProps) {
  const { status } = useSync()
  if (status !== 'live') return null
  return <ConnectedInviteLink {...props} />
}

function ConnectedResetInviteLink({
  gameId,
  onReset,
}: {
  gameId: string
  /** The new link, for whatever shows it. */
  onReset?: (url: string) => void
}) {
  const reset = useGamesCall('invites.reset')
  const [confirming, setConfirming] = useState(false)

  async function run(): Promise<void> {
    const token = await reset({ gameId })
    if (typeof token === 'string') onReset?.(inviteUrl(token))
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
