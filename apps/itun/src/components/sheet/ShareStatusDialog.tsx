/**
 * ShareStatusDialog — sharing, answered on the sheet itself.
 *
 * ## Why this replaced a screen
 *
 * Sharing used to be its own route (`/sheet/:kind/:id/share`) whose left half
 * was a "preview" that hand-rolled a hero band and disagreed with what the
 * recipient actually saw. The sheet you are standing on IS the preview, so
 * sharing is a status you check, not a place you go: a dialog over the live
 * sheet, and one less route and one less duplicate of the derived-stat math.
 *
 * ## One way to share
 *
 * The live public sheet ([ADR-032](../../../../../docs/ARCHITECTURE.md#adr-032))
 * is the only account-free way to share
 * ([ADR-036](../../../../../docs/ARCHITECTURE.md#adr-036)), so the dialog is
 * `PublicSheetPanel` — on/off, the link, a QR of it — and a sentence that
 * frames it.
 *
 * ## The panel only mounts Connected
 *
 * `PublicSheetPanel` calls Convex hooks unconditionally, so it must not MOUNT
 * outside Connected — see its own header. Everywhere else the dialog says what
 * sharing needs instead of offering a control that cannot work: an anonymous
 * visitor is told it needs an account (with the sign-in control, which renders
 * nothing in a build that has no accounts), and a signed-in player without a
 * live connection is told that.
 */

import { ModalShell } from 'component-lib'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { SignInControl } from '../account/SignInControl'
import { PublicSheetPanel } from './PublicSheetPanel'

type ShareStatusDialogProps = {
  kind: EntityRef['type']
  id: string
  entity: Pilot | Mech | Crawler
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

const PANEL_HEADING_CLASS =
  'mb-3 font-cond text-caption font-semibold uppercase tracking-caps-snug text-ink'

const NOTE_CLASS = 'text-wk-muted mb-0 mt-0 font-body text-caption leading-relaxed'

export function ShareStatusDialog({
  kind,
  id,
  entity,
  open,
  onOpenChange,
  clipboardWriter,
}: ShareStatusDialogProps) {
  const { mode } = useConnection()

  /**
   * Whether `PublicSheetPanel` MOUNTS. Not a style choice: that component calls
   * Convex hooks, which cannot be called conditionally and throw outright with
   * no provider — precisely the Solo case. Gating on render is what keeps Solo
   * working.
   */
  const showLive = isConvexConfigured && mode === 'connected'

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Share status"
      subtitle={entity.name}
      description={`Share ${entity.name} as a live, read-only page, or stop sharing it.`}
      maxWidth="max-w-xl"
    >
      {/*
        Sections, not Panels. ModalShell already frames this in a Card, and a
        bordered Panel inside a bordered Card is the double-framing the sheet
        rules forbid. The padding was the Panel's; ModalShell's Card body
        supplies none.
      */}
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {/* Read-only is the promise that holds whichever branch renders below. */}
        <p className={NOTE_CLASS}>
          Whoever has the link gets a read-only view of {entity.name} that keeps up with the sheet.
        </p>

        {showLive ? (
          <PublicSheetPanel
            kind={kind}
            appId={id}
            entityName={entity.name}
            headingClass={PANEL_HEADING_CLASS}
            clipboardWriter={clipboardWriter}
          />
        ) : mode === 'solo' ? (
          <section className="flex flex-col items-start gap-3">
            <p className={NOTE_CLASS}>
              Sharing needs an account: the public page is served from your saved sheet, and an
              unsaved one has nothing to serve. No account is needed to read it.
            </p>
            <SignInControl />
          </section>
        ) : (
          <p className={NOTE_CLASS}>
            Sharing settings need a live connection to your account. Try again once you are
            connected.
          </p>
        )}
      </div>
    </ModalShell>
  )
}
