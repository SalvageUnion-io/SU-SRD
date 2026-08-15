/**
 * ShareStatusDialog — sharing, answered on the sheet itself.
 *
 * ## Why this replaced a screen
 *
 * Sharing used to be its own route (`/sheet/:kind/:id/share`) whose left half
 * was a "Snapshot preview" — a private ~250-line component that hand-rolled a
 * hero band from `SheetHero` and re-derived every max-stat computation, then
 * showed no rail, no systems, no cargo and no abilities. It was not what the
 * recipient sees: `/s/:id` renders the REAL sheet read-only, through
 * `frozenSheet.ts` + `<Sheet readOnly />`, and the preview deliberately omitted
 * the pilot-ability context the published payload actually carries — so a mech
 * previewed LOWER than it shared.
 *
 * A preview that disagrees with the thing it previews is worse than none. And
 * the fix is not a better preview: the sheet you are standing on IS the
 * preview, so sharing is a status you check, not a place you go. Hence a dialog
 * over the live sheet, and one less route, one less screen and one less
 * duplicate of the derived-stat math.
 *
 * ## The two share models are deliberately both here
 *
 * They answer different questions and a player choosing between them should see
 * both (ADR-004, ADR-032):
 *
 *   Snapshot      frozen at publish time; the id IS the capability, including
 *                 for revocation; no account.
 *   Public sheet  live, follows the sheet as it changes; opt-in per entity;
 *                 revoked by switching it off, everywhere at once.
 *
 * ## Two gates that are not the same gate
 *
 * `PublicSheetPanel` calls Convex hooks unconditionally, so it must not MOUNT
 * outside Connected — see its own header. The snapshot half has no such
 * constraint and works in Solo, which is the whole point of it.
 */

import { Button, FieldError, Input, ModalShell, SnapshotQr, toast } from 'component-lib'
import { useEffect, useState } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { captureMessage } from '../../lib/observability'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { PublishResult, SnapshotPayload } from '../../lib/snapshot/client'
import { deleteSnapshot, probeSnapshotService, publishSnapshot } from '../../lib/snapshot/client'
import type { PublishedSnapshot } from '../../lib/snapshot/publishedSnapshots'
import {
  listPublishedSnapshotsFor,
  recordPublishedSnapshot,
  removePublishedSnapshot,
} from '../../lib/snapshot/publishedSnapshots'
import { PublicSheetPanel } from './PublicSheetPanel'

type ShareStatusDialogProps = {
  kind: EntityRef['type']
  id: string
  entity: Pilot | Mech | Crawler
  /**
   * The piloted mech's pilot ability refs, which travel WITH the snapshot.
   *
   * Beefcake raises the piloted mech's Max SP and Cargo (ADR-029), and a
   * snapshot carries a live instance rather than a build template — so without
   * these a shared mech reads lower than the same mech on its owner's sheet.
   */
  pilotAbilities?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Injectable publish function for testing. */
  publishFn?: (payload: SnapshotPayload) => Promise<PublishResult>
  /** Injectable revoke/un-publish function for testing. */
  deleteFn?: (id: string) => Promise<void>
  /** Injectable backend feature-detect for testing. */
  probeFn?: () => Promise<boolean>
  /** Injectable clipboard writer for testing. */
  clipboardWriter?: (text: string) => Promise<void>
}

type ServiceState = 'checking' | 'available' | 'unavailable'

type PublishState =
  | { status: 'idle' }
  | { status: 'publishing' }
  | { status: 'published'; shareUrl: string }
  | { status: 'error'; message: string }

const PANEL_HEADING_CLASS =
  'mb-3 font-cond text-caption font-semibold uppercase tracking-caps-snug text-ink'

export function ShareStatusDialog({
  kind,
  id,
  entity,
  pilotAbilities,
  open,
  onOpenChange,
  publishFn = publishSnapshot,
  deleteFn = deleteSnapshot,
  probeFn = probeSnapshotService,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: ShareStatusDialogProps) {
  // Decides whether the public-sheet panel mounts at all — see its header.
  const { mode: connectionMode } = useConnection()

  const [service, setService] = useState<ServiceState>('checking')
  const [publishState, setPublishState] = useState<PublishState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  // Links published from THIS build — the revoke ledger. The snapshot id is the
  // only capability (no auth), so it lives in localStorage and is the player's
  // handle on their own shared links.
  const [links, setLinks] = useState<PublishedSnapshot[]>(() => listPublishedSnapshotsFor(kind, id))

  /**
   * The probe is gated on `open`, and that is the point of putting it here.
   *
   * As a screen this ran on mount, which was once per deliberate visit. This
   * dialog is mounted by every live sheet, so an ungated probe would fire a
   * request on every sheet view — turning a feature-detect into background
   * traffic on the app's most-visited surface.
   */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void probeFn().then((available) => {
      if (cancelled) return
      setService(available ? 'available' : 'unavailable')
      // The outage this feature-detect otherwise absorbs silently (no-op with
      // no DSN): on a production deploy the snapshot Functions are always
      // present, so "unavailable" means the backend is down — not a feature
      // that was never built. Exactly this fired while the Functions 502'd.
      if (!available) captureMessage('snapshot service unavailable', { kind, id })
    })
    return () => {
      cancelled = true
    }
  }, [open, probeFn, kind, id])

  // Re-read the ledger on open: another tab, or an earlier visit this session,
  // may have published or revoked since this dialog was last rendered.
  useEffect(() => {
    if (open) setLinks(listPublishedSnapshotsFor(kind, id))
  }, [open, kind, id])

  const shareUrl = publishState.status === 'published' ? publishState.shareUrl : null

  async function handlePublish(): Promise<void> {
    setPublishState({ status: 'publishing' })
    setCopied(false)
    setCopyError(null)

    // Additive to the v1 `{ kind, entity }` shape: older snapshots simply have
    // no `context`, and the reader treats it as absent rather than empty.
    const payload: SnapshotPayload = {
      kind,
      entity,
      ...(pilotAbilities ? { context: { pilotAbilities } } : {}),
    }

    try {
      const result = await publishFn(payload)
      setPublishState({
        status: 'published',
        shareUrl: `${window.location.origin}/s/${result.id}`,
      })
      recordPublishedSnapshot({
        id: result.id,
        kind,
        entityId: id,
        name: entity.name,
        publishedAt: new Date().toISOString(),
      })
      setLinks(listPublishedSnapshotsFor(kind, id))
      toast.success('Snapshot published.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setPublishState({ status: 'error', message: `Failed to publish: ${message}` })
      toast.error(`Failed to publish: ${message}`)
    }
  }

  async function handleCopy(): Promise<void> {
    if (!shareUrl) return
    setCopyError(null)
    try {
      await clipboardWriter(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Failed to copy — select the URL and copy it manually.')
    }
  }

  /**
   * Revoke a shared link: DELETE the blob, then forget it locally. A failure
   * keeps the local record so the player can retry — dropping it would leave a
   * live link with no handle on it.
   */
  async function handleRevoke(snapId: string): Promise<void> {
    try {
      await deleteFn(snapId)
      removePublishedSnapshot(snapId)
      setLinks(listPublishedSnapshotsFor(kind, id))
      // If the just-published link was the one revoked, reset so the URL field
      // stops advertising a dead link.
      if (publishState.status === 'published' && publishState.shareUrl.endsWith(`/s/${snapId}`)) {
        setPublishState({ status: 'idle' })
      }
      toast.success('Shared link removed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Failed to remove shared link: ${message}`)
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Share status"
      subtitle={entity.name}
      description={`Publish, copy or revoke share links for ${entity.name}.`}
      maxWidth="max-w-xl"
    >
      {/*
        Sections, not Panels. ModalShell already frames this in a Card, and a
        bordered Panel inside a bordered Card is the double-framing the sheet
        rules forbid — it is most of what made the old share screen read as
        unfinished. Separation comes from a rule between the two share models,
        which is also the only place separation means anything here.
      */}
      {/* The padding was the Panel's; ModalShell's Card body supplies none. */}
      <div className="flex flex-col gap-5 divide-y-2 divide-ink/10 p-4 sm:p-5 [&>*+*]:pt-5">
        <section>
          <h2 className={PANEL_HEADING_CLASS}>Snapshot link</h2>

          {/*
            The status line, and the reason this dialog is called "Share status"
            rather than "Share": the first thing a player wants is not a control,
            it is an answer to "is this already out there?".
          */}
          <p className="text-wk-muted mb-3 mt-0 font-body text-caption leading-relaxed">
            {links.length === 0 ? (
              <>Not shared. Publishing mints a frozen copy of this build at a link.</>
            ) : (
              <>
                Shared — {links.length} live {links.length === 1 ? 'link' : 'links'}. Each is frozen
                at the moment it was published, so later edits to {entity.name} won&rsquo;t change
                what it shows.
              </>
            )}
          </p>

          {shareUrl !== null && (
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  aria-label="Share URL"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  size="compact"
                  onClick={() => void handleCopy()}
                  aria-label="Copy share URL"
                  title="Copy share URL"
                  className="shrink-0"
                >
                  {copied ? '✓' : '⧉'}
                </Button>
              </div>
              {/*
                The QR survived the share screen's deletion, but not its panel.
                Passing a phone across a table is the actual use, and it needs
                no heading, no placeholder and no "publish to generate a QR
                code" copy — it is simply there once there is a link to encode.
              */}
              <div className="flex items-center gap-3">
                <SnapshotQr url={shareUrl} />
                <p className="text-wk-muted mb-0 font-body text-caption">
                  Scan to open on another device.
                </p>
              </div>
            </div>
          )}

          {copyError !== null && <FieldError className="mb-2">{copyError}</FieldError>}

          {service === 'unavailable' ? (
            /* The backend is unreachable — Publish hides, the note explains. */
            <p
              role="note"
              title="The snapshot service could not be reached — publishing needs the deployed /api/snapshots endpoint."
              className="text-wk-muted mb-0 rounded-card border-chrome border-dashed border-wk-faint px-3 py-2.5 font-body text-caption"
            >
              Publishing unavailable — the snapshot service could not be reached.
            </p>
          ) : (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => void handlePublish()}
              disabled={service === 'checking' || publishState.status === 'publishing'}
            >
              {publishState.status === 'publishing'
                ? 'Publishing…'
                : links.length > 0
                  ? 'Publish a new link'
                  : 'Publish snapshot'}
            </Button>
          )}

          {publishState.status === 'error' && (
            <FieldError className="mt-2">{publishState.message}</FieldError>
          )}

          {links.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {links.map((link) => (
                <li key={link.id} className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-body text-xs text-ink">
                    /s/{link.id}
                  </code>
                  <Button
                    size="compact"
                    variant="danger"
                    className="min-h-11 shrink-0 sm:min-h-9"
                    aria-label={`Remove shared link ${link.id}`}
                    onClick={() => void handleRevoke(link.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-wk-muted mb-0 mt-3 font-body text-xs leading-relaxed">
            No account needed. The snapshot stores no personal data — just the build.
          </p>
        </section>

        {/*
          Mounted only when connected, and the check belongs HERE rather than
          inside the panel: it calls Convex hooks, which cannot be called
          conditionally and throw with no provider — precisely the Solo case.
          Gating on render is what keeps Solo working.
        */}
        {isConvexConfigured && connectionMode === 'connected' && (
          <PublicSheetPanel
            kind={kind}
            appId={id}
            entityName={entity.name}
            headingClass={PANEL_HEADING_CLASS}
          />
        )}
      </div>
    </ModalShell>
  )
}
