/**
 * ShareSnapshotScreen — the Share Snapshot screen (design §3.4, plan 5.2).
 *
 * Layout: standard top bar ('← {name}' back to the sheet · 'Share snapshot' ·
 * kind pill), then a `1fr 360px` body grid. Left: 'Snapshot preview' panel
 * rendering the build as a read-only entity card (the SheetHero — "the entity
 * card writ large") plus copy stating the snapshot model. Right aside:
 * anonymous-link panel (read-only URL + ⧉ copy + full-width Publish primary +
 * privacy microcopy), QR panel, and a Print/PDF row linking the sheet view
 * (where the A4 print stylesheet applies).
 *
 * Publish feature-detects the snapshot backend (S6): probeSnapshotService runs
 * on mount; while unreachable the Publish primary is hidden and an explanatory
 * note (with a title tooltip) renders in its place.
 *
 * Snapshots are bare-entity v1 ({ kind, entity }) — wired-composition
 * bundling stays a post-beta stretch (plan 5.2).
 *
 * Dep-injection (no mock.module()): entityStore, publishFn, probeFn and
 * clipboardWriter are all overridable via props.
 */

import { useEffect, useState } from 'react'
import {
  Badge,
  BayStatus,
  Button,
  Input,
  Panel,
  Row,
  Stat,
  VitalGauge,
  heatDangerFrom,
  toast,
} from 'component-lib'
import type { BadgeTone } from 'component-lib'

import { resolveClassName } from '../../lib/classRef'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import type { EntityRef } from '../../lib/schemas/entity'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { computeMechCapacity } from '../../lib/rules/capacity'
import {
  crawlerMaxSP,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { useEntity } from '../../hooks/queries'
import { captureMessage } from '../../lib/observability'
import { deleteSnapshot, probeSnapshotService, publishSnapshot } from '../../lib/snapshot/client'
import type { PublishResult, SnapshotPayload } from '../../lib/snapshot/client'
import {
  listPublishedSnapshotsFor,
  recordPublishedSnapshot,
  removePublishedSnapshot,
} from '../../lib/snapshot/publishedSnapshots'
import type { PublishedSnapshot } from '../../lib/snapshot/publishedSnapshots'
import { AppLink } from '../shared/AppLink'

import type { EntityLookup } from './composition'
import { SheetHero, ChassisStats } from 'component-lib'
import { SnapshotQr } from './SnapshotQr'
import type { ChassisStatItem } from 'component-lib'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'

type ShareSnapshotScreenProps = {
  kind: EntityRef['type']
  id: string
  /** Injectable entity lookup for testing; the live store when omitted. */
  entityStore?: EntityLookup
  /** Injectable publish function for testing. */
  publishFn?: (payload: SnapshotPayload) => Promise<PublishResult>
  /** Injectable revoke/un-publish function for testing. */
  deleteFn?: (id: string) => Promise<void>
  /** Injectable backend feature-detect for testing (S6). */
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

const KIND_PILL: Record<EntityRef['type'], { label: string; tone: BadgeTone }> = {
  pilot: { label: 'Pilot', tone: 'pilot' },
  mech: { label: 'Mech', tone: 'mech' },
  crawler: { label: 'Crawler', tone: 'crawler' },
}

const PANEL_HEADING_CLASS =
  'mb-3 font-cond text-caption font-semibold uppercase tracking-caps-snug text-ink'

export function ShareSnapshotScreen({
  kind,
  id,
  entityStore,
  publishFn = publishSnapshot,
  deleteFn = deleteSnapshot,
  probeFn = probeSnapshotService,
  clipboardWriter = (text) => navigator.clipboard.writeText(text),
}: ShareSnapshotScreenProps) {
  // Reactive read from the live store; unused when a lookup is injected
  // (hook is still called unconditionally — Rules of Hooks).
  const liveEntity = useEntity(kind, id)

  const [service, setService] = useState<ServiceState>('checking')
  const [publishState, setPublishState] = useState<PublishState>({
    status: 'idle',
  })
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  // Locally-tracked links published from THIS build — the revoke ledger. The
  // snapshot id is the only capability (local-first, no auth), so it lives in
  // localStorage and is the user's handle on their own shared links.
  const [links, setLinks] = useState<PublishedSnapshot[]>(() => listPublishedSnapshotsFor(kind, id))

  useEffect(() => {
    let cancelled = false
    void probeFn().then((available) => {
      if (!cancelled) {
        setService(available ? 'available' : 'unavailable')
        // Surface the outage this feature-detect already silently absorbs
        // (no-op unless VITE_SENTRY_DSN is set): on a production deploy the
        // snapshot Functions are always present, so "unavailable" here means
        // the backend is actually down, not a feature that was never built.
        if (!available) {
          captureMessage('snapshot service unavailable', { kind, id })
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [probeFn, kind, id])

  const entity = entityStore ? entityStore.get(kind, id) : liveEntity

  if (!entity) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Nothing to share</h1>
        <p className="text-wk-muted mb-4 text-sm">
          This {kind} no longer exists, so there is nothing to publish.
        </p>
        <AppLink href="/" className="text-sm underline">
          &larr; Back to Roster
        </AppLink>
      </main>
    )
  }

  const sheetHref = `/sheet/${kind}/${id}`
  const shareUrl = publishState.status === 'published' ? publishState.shareUrl : null
  // Narrowed local — `entity` is non-null past the guard above, but the async
  // closures below don't inherit that narrowing.
  const entityName = entity.name

  async function handlePublish() {
    setPublishState({ status: 'publishing' })
    setCopied(false)
    setCopyError(null)

    // Bare-entity snapshot payload (v1) — wired composition is post-beta.
    const payload: SnapshotPayload = {
      kind,
      entity: entity as unknown as Record<string, unknown>,
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
        name: entityName,
        publishedAt: new Date().toISOString(),
      })
      setLinks(listPublishedSnapshotsFor(kind, id))
      toast.success('Snapshot published.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setPublishState({
        status: 'error',
        message: `Failed to publish: ${message}`,
      })
      toast.error(`Failed to publish: ${message}`)
    }
  }

  async function handleCopy() {
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
   * Revoke a shared link: DELETE the blob, then forget it locally. The delete
   * only actually removes the snapshot once the backend is deployed, so failure
   * surfaces as a toast and the local record is kept for a retry.
   */
  async function handleRevoke(snapId: string) {
    try {
      await deleteFn(snapId)
      removePublishedSnapshot(snapId)
      setLinks(listPublishedSnapshotsFor(kind, id))
      // If the just-published link was the one revoked, reset the panel so the
      // URL/QR no longer advertise a dead link.
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
    <div
      className={`sheet--${kind} min-h-screen`}
      style={{ background: 'var(--ground)' }}
      data-kind={kind}
    >
      {/* Top bar — mirrors the LiveSheet .sbar (design §3.4 / §4.1) */}
      <header
        className="flex min-h-[58px] flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink px-4 py-2 sm:px-[30px]"
        style={{ background: 'var(--ground-2)' }}
      >
        <AppLink
          href={sheetHref}
          aria-label={`Back to ${entity.name}`}
          className="shrink-0 font-cond text-caption font-semibold uppercase tracking-caps-tight text-ink no-underline hover:text-rust"
        >
          &larr; {entity.name}
        </AppLink>
        <h1 className="m-0 font-cond text-lg font-bold uppercase leading-none text-ink">
          Share snapshot
        </h1>
        <span className="ml-auto">
          <Badge surface="tone" tone={KIND_PILL[kind].tone}>
            {KIND_PILL[kind].label}
          </Badge>
        </span>
      </header>

      <main className="grid items-start gap-[30px] px-4 pb-[60px] pt-6 sm:px-[30px] lg:grid-cols-[1fr_360px]">
        {/* Preview panel — the build as a read-only entity card */}
        <Panel className="p-4 sm:p-5">
          <h2 className={PANEL_HEADING_CLASS}>Snapshot preview</h2>
          <SnapshotPreviewCard kind={kind} entity={entity} />
          <p className="text-wk-muted mb-0 mt-3.5 font-body text-caption leading-relaxed">
            A snapshot is frozen at publish time — later edits to {entity.name} won&rsquo;t change
            what the link shows. Publish again to share an updated build.
          </p>
        </Panel>

        {/* Aside — anonymous link, QR, print */}
        <aside className="flex flex-col gap-5">
          <Panel className="p-4 sm:p-5">
            <h2 className={PANEL_HEADING_CLASS}>Anonymous link</h2>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl ?? ''}
                placeholder="Publish to generate a link"
                aria-label="Share URL"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                onClick={() => void handleCopy()}
                disabled={!shareUrl}
                aria-label="Copy share URL"
                title="Copy share URL"
                className="shrink-0"
              >
                {copied ? '✓' : '⧉'}
              </Button>
            </div>

            {copyError && (
              <p role="alert" className="mb-0 mt-2 font-body text-xs text-rust">
                {copyError}
              </p>
            )}

            <div className="mt-3">
              {service === 'unavailable' ? (
                /* S6: the backend is unreachable — Publish hides, note explains. */
                <p
                  role="note"
                  title="The snapshot service could not be reached — publishing needs the deployed /api/snapshots endpoint."
                  className="text-wk-muted mb-0 rounded-[3px] border-chrome border-dashed border-wk-faint px-3 py-2.5 font-body text-caption"
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
                    : publishState.status === 'published'
                      ? 'Publish again'
                      : 'Publish snapshot'}
                </Button>
              )}
            </div>

            {publishState.status === 'error' && (
              <p role="alert" className="mb-0 mt-2 font-body text-xs text-rust">
                {publishState.message}
              </p>
            )}

            <p className="text-wk-muted mb-0 mt-3 font-body text-xs leading-relaxed">
              No account needed. The snapshot stores no personal data — just the build.
            </p>
          </Panel>

          {links.length > 0 && (
            <Panel className="p-4 sm:p-5">
              <h2 className={PANEL_HEADING_CLASS}>Shared links</h2>
              <p className="text-wk-muted mb-3 mt-0 font-body text-caption leading-relaxed">
                Links you&rsquo;ve published for {entity.name}. Removing one revokes it — the shared
                page then shows &ldquo;not found&rdquo;.
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate font-body text-xs text-ink">
                      /s/{link.id}
                    </code>
                    <Button
                      size="sm"
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
            </Panel>
          )}

          <Panel className="p-4 sm:p-5">
            <h2 className={PANEL_HEADING_CLASS}>QR code</h2>
            <div className="flex items-center gap-3.5">
              {shareUrl ? (
                <SnapshotQr url={shareUrl} />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-[84px] w-[84px] shrink-0 rounded-[3px] border-chrome border-ink"
                  style={{
                    background:
                      'repeating-conic-gradient(var(--color-ink) 0 25%, #fff 0 50%) 0 / 16px 16px',
                  }}
                />
              )}
              <p className="text-wk-muted mb-0 font-body text-caption">
                {shareUrl ? 'Scan to open' : 'Publish to generate a QR code'}
              </p>
            </div>
          </Panel>

          <Row
            name="Print / PDF"
            meta="The sheet view prints on the A4 stylesheet"
            actions={
              <AppLink
                href={sheetHref}
                className="rounded-[3px] border-chrome border-ink bg-paper px-[11px] py-[6px] font-body text-xs font-medium text-ink no-underline transition-colors duration-[120ms] hover:bg-wk-bg-2"
              >
                Open print view
              </AppLink>
            }
          />
        </aside>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview card — the read-only entity card (SheetHero, no rail/conditions)
// ---------------------------------------------------------------------------

type SnapshotPreviewCardProps = {
  kind: EntityRef['type']
  entity: Pilot | Mech | Crawler
}

/**
 * Read-only "entity card writ large" preview of the build — the same
 * SheetHero frame the live sheets use, with static StatBlocks and no
 * rail/conditions affordances (everything a snapshot freezes is here).
 */
function SnapshotPreviewCard({ kind, entity }: SnapshotPreviewCardProps) {
  if (kind === 'pilot') {
    const pilot = entity as Pilot
    const maxHP = Math.max(0, pilotMaxHP(pilot))
    const maxAP = Math.max(0, pilotMaxAP(pilot))
    return (
      <SheetHero
        cat="Pilot"
        name={pilot.name}
        meta={
          <>
            <Stat orientation="horizontal" label="Callsign" value={`“${pilot.callsign}”`} />
            <Stat orientation="horizontal" label="Class" value={resolveClassName(pilot.classRef)} />
          </>
        }
        identity={[
          { label: 'Background', value: pilot.background ?? '' },
          { label: 'Motto', value: pilot.motto ?? '' },
          { label: 'Keepsake', value: pilot.keepsake ?? '' },
          { label: 'Appearance', value: pilot.appearance ?? '' },
        ]}
        trackers={
          <>
            <VitalGauge
              label="HP"
              max={maxHP}
              value={Math.min(pilot.currentHP ?? maxHP, maxHP)}
              readOnly
            />
            <VitalGauge
              label="AP"
              max={maxAP}
              value={Math.min(pilot.currentAP ?? maxAP, maxAP)}
              readOnly
            />
            <Stat label="TP" value={pilot.trainingPoints ?? 0} />
          </>
        }
      />
    )
  }

  if (kind === 'mech') {
    const mech = entity as Mech
    const chassis = resolveChassisRef(mech.chassisRef)
    const maxSP = mechMaxSP(mech, chassis)
    const maxEP = mechMaxEP(mech, chassis)
    const maxHeat = mechMaxHeat(mech, chassis)
    const maxCargo = mechMaxCargo(mech, chassis)
    const capacity = computeMechCapacity({
      chassisRef: mech.chassisRef,
      systems: mech.systems.map((ref) => ({ ref })),
      modules: mech.modules.map((ref) => ({ ref })),
    })
    const specs: ChassisStatItem[] = [
      {
        code: 'SYS',
        name: 'Slots',
        value: capacity.systemSlotsUsed,
        max: capacity.systemSlotsMax,
        pips: capacity.systemSlotsMax <= 12,
      },
      {
        code: 'MOD',
        name: 'Slots',
        value: capacity.moduleSlotsUsed,
        max: capacity.moduleSlotsMax,
        pips: capacity.moduleSlotsMax <= 12,
      },
      ...(typeof chassis?.salvageValue === 'number'
        ? [{ code: 'SV', name: 'Salvage', value: chassis.salvageValue }]
        : []),
    ]
    return (
      <SheetHero
        cat="Mech"
        name={mech.name}
        meta={
          <>
            <Stat
              orientation="horizontal"
              label="Chassis"
              value={chassis?.name ?? mech.chassisRef}
            />
            {chassis && typeof chassis.techLevel === 'number' && (
              <Stat orientation="horizontal" label="Tech LV" value={chassis.techLevel} />
            )}
          </>
        }
        identity={mech.patternName ? [{ label: 'Pattern', value: mech.patternName }] : []}
        specs={<ChassisStats items={specs} />}
        trackers={
          <>
            <VitalGauge
              label="SP"
              subLabel="Structure"
              max={maxSP}
              value={Math.min(mech.currentSP ?? maxSP, maxSP)}
              readOnly
            />
            <VitalGauge
              label="EP"
              subLabel="Energy"
              max={maxEP}
              value={Math.min(mech.currentEP ?? maxEP, maxEP)}
              readOnly
            />
            <VitalGauge
              label="Heat"
              max={maxHeat}
              value={Math.min(mech.currentHeat ?? maxHeat, maxHeat)}
              danger={maxHeat > 0 ? heatDangerFrom(maxHeat) : undefined}
              readOnly
            />
            <VitalGauge
              label="Cargo"
              max={maxCargo}
              value={totalLotUnits(mech.cargoLots)}
              caption={['Used', 'Cap']}
              readOnly
            />
          </>
        }
      />
    )
  }

  const crawler = entity as Crawler
  const maxSP = crawlerMaxSP(crawler)
  const tl = parseCrawlerTechLevel(crawler.techLevel)
  const states = (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
  return (
    <SheetHero
      cat="Crawler"
      name={crawler.name}
      meta={
        tl !== undefined ? <Stat orientation="horizontal" label="Tech LV" value={tl} /> : undefined
      }
      trackers={
        <>
          <VitalGauge
            label="SP"
            max={maxSP}
            value={Math.min(crawler.currentSP ?? maxSP, maxSP)}
            caption={['Structure', 'Max']}
            readOnly
          />
          {states.length > 0 && <BayStatus label="Bays" states={states} />}
        </>
      }
    />
  )
}
