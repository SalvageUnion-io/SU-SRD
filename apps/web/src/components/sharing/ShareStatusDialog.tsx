/**
 * ShareStatusDialog — who can see it, answered where the thing stands.
 *
 * ## One control for everything a player shares
 *
 * Pilots, mechs, crawlers, built NPCs and mech patterns all open this dialog
 * from their own page's Share button, and it asks them all the same question
 * in the same words: Who can see it — Only me, My Game's crew, or Anyone with
 * the link (`ShareSettings`, `lib/sharing/visibility.ts`).
 *
 * ## Why a dialog, not a screen
 *
 * The page you are standing on IS the preview, so sharing is a status you
 * check, not a place you go: a dialog over the live page, with no second
 * rendering of the derived-stat math to disagree with what the recipient sees.
 *
 * ## One account-free way to share
 *
 * The live public page ([ADR-032](../../../../../docs/adr/032-public-read-only-sheets.md))
 * is the only account-free way to share
 * ([ADR-036](../../../../../docs/ARCHITECTURE.md#decisions)): "Anyone with the
 * link", its link and a QR of it.
 *
 * ## The settings only mount Connected
 *
 * `ShareSettings` calls Convex hooks unconditionally, so it must not MOUNT
 * outside Connected — see its own header. Everywhere else the dialog says what
 * sharing needs instead of offering a control that cannot work: an anonymous
 * visitor is told it needs an account (with the sign-in control), and a
 * signed-in player without a live connection is told that.
 */

import type { CSSProperties } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ShareKind } from '../../lib/sharing/visibility'
import { SignInControl } from '../account/SignInControl'
import { ModalShell, tokens } from '../index'
import { ShareSettings } from './ShareSettings'

type ShareStatusDialogProps = {
  kind: ShareKind
  /** The app-level id: what the public page is addressed by. */
  id: string
  /** What it is called, for the dialog's subtitle and its copy. */
  name: string
  /** A sheet's container: the Game it is in, or null on the shelf. Unused for a pattern. */
  gameId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

const NOTE = {
  color: tokens.color.wkMuted,
  marginBottom: 0,
  marginTop: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  lineHeight: 1.625,
} satisfies CSSProperties

/** The dialog body's stack; its padding steps up at `sm` (`.su-sheet-share-body`). */
const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[20],
} satisfies CSSProperties

const SIGN_IN = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: tokens.space[12],
} satisfies CSSProperties

export function ShareStatusDialog({
  kind,
  id,
  name,
  gameId,
  open,
  onOpenChange,
  clipboardWriter,
}: ShareStatusDialogProps) {
  const { mode } = useConnection()

  /** Whether `ShareSettings` MOUNTS: only Connected (see its own header). */
  const showLive = mode === 'connected'

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Share status"
      subtitle={name}
      description={`Choose who can see ${name}.`}
      maxWidth="su-sheet-share-dialog"
    >
      {/*
        Sections, not Panels. ModalShell already frames this in a Card, and a
        bordered Panel inside a bordered Card is the double-framing the sheet
        rules forbid. The padding was the Panel's; ModalShell's Card body
        supplies none.
      */}
      <div className="su-sheet-share-body" style={BODY}>
        {/* Read-only is the promise that holds whichever branch renders below. */}
        <p style={NOTE}>
          Whoever can see {name} gets a read-only view of it that keeps up with every change.
        </p>

        {showLive ? (
          <ShareSettings kind={kind} appId={id} gameId={gameId} clipboardWriter={clipboardWriter} />
        ) : mode === 'solo' ? (
          <section style={SIGN_IN}>
            <p style={NOTE}>
              Sharing needs an account: the public page is served from what your account saves. No
              account is needed to read it.
            </p>
            <SignInControl />
          </section>
        ) : (
          <p style={NOTE}>
            Sharing settings need a live connection to your account. Try again once you are
            connected.
          </p>
        )}
      </div>
    </ModalShell>
  )
}
