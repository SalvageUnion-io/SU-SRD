/**
 * ShareStatusDialog — sharing, answered on the sheet itself.
 *
 * ## Why a dialog, not a screen
 *
 * The sheet you are standing on IS the preview, so sharing is a status you
 * check, not a place you go: a dialog over the live sheet, with no second
 * rendering of the derived-stat math to disagree with what the recipient sees.
 *
 * ## One way to share
 *
 * The live public sheet ([ADR-032](../../../../../docs/adr/032-public-read-only-sheets.md))
 * is the only account-free way to share
 * ([ADR-036](../../../../../docs/ARCHITECTURE.md#decisions)), so the dialog is
 * `PublicSheetPanel` — on/off, the link, a QR of it — and a sentence that
 * frames it.
 *
 * ## The panel only mounts Connected
 *
 * `PublicSheetPanel` calls Convex hooks unconditionally, so it must not MOUNT
 * outside Connected — see its own header. Everywhere else the dialog says what
 * sharing needs instead of offering a control that cannot work: an anonymous
 * visitor is told it needs an account (with the sign-in control), and a
 * signed-in player without a live connection is told that.
 */

import { ModalShell, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import type { Crawler } from '../../lib/schemas/crawler'
import type { SheetEntityKind } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { SignInControl } from '../account/SignInControl'
import { PublicSheetPanel } from './PublicSheetPanel'

type ShareStatusDialogProps = {
  kind: SheetEntityKind
  id: string
  entity: Pilot | Mech | Crawler
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

const PANEL_HEADING = {
  marginBottom: tokens.space[12],
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.capsSnug,
  color: tokens.color.ink,
} satisfies CSSProperties

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
  entity,
  open,
  onOpenChange,
  clipboardWriter,
}: ShareStatusDialogProps) {
  const { mode } = useConnection()

  /** Whether `PublicSheetPanel` MOUNTS: only Connected (see its own header). */
  const showLive = mode === 'connected'

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Share status"
      subtitle={entity.name}
      description={`Share ${entity.name} as a live, read-only page, or stop sharing it.`}
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
          Whoever has the link gets a read-only view of {entity.name} that keeps up with the sheet.
        </p>

        {showLive ? (
          <PublicSheetPanel
            kind={kind}
            appId={id}
            entityName={entity.name}
            headingStyle={PANEL_HEADING}
            clipboardWriter={clipboardWriter}
          />
        ) : mode === 'solo' ? (
          <section style={SIGN_IN}>
            <p style={NOTE}>
              Sharing needs an account: the public page is served from your saved sheet, and an
              unsaved one has nothing to serve. No account is needed to read it.
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
