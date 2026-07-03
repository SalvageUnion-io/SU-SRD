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
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn, Input, MChip, Panel, Pill, Row, StatBlock, toast } from 'suref-react'
import type { PillTone } from 'suref-react'

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
import { probeSnapshotService, publishSnapshot } from '../../lib/snapshot/client'
import type { PublishResult, SnapshotPayload } from '../../lib/snapshot/client'
import { AppLink } from '../shared/AppLink'

import type { EntityLookup } from './composition'
import { SheetHero, ChassisStats } from './SheetHero'
import type { ChassisStatItem } from './SheetHero'

type ShareSnapshotScreenProps = {
  kind: EntityRef['type']
  id: string
  /** Injectable entity lookup for testing; the live store when omitted. */
  entityStore?: EntityLookup
  /** Injectable publish function for testing. */
  publishFn?: (payload: SnapshotPayload) => Promise<PublishResult>
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

const KIND_PILL: Record<EntityRef['type'], { label: string; tone: PillTone }> = {
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

  useEffect(() => {
    let cancelled = false
    void probeFn().then((available) => {
      if (!cancelled) setService(available ? 'available' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [probeFn])

  const entity = entityStore ? entityStore.get(kind, id) : liveEntity

  if (!entity) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="mb-2 text-xl font-bold">Nothing to share</h1>
        <p className="text-wk-muted mb-4 text-sm">
          This {kind} no longer exists, so there is nothing to publish.
        </p>
        <AppLink href="/" className="text-sm underline">
          &larr; Back to dashboard
        </AppLink>
      </main>
    )
  }

  const sheetHref = `/sheet/${kind}/${id}`
  const shareUrl = publishState.status === 'published' ? publishState.shareUrl : null

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
          <Pill tone={KIND_PILL[kind].tone}>{KIND_PILL[kind].label}</Pill>
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
              <Btn
                size="sm"
                onClick={() => void handleCopy()}
                disabled={!shareUrl}
                aria-label="Copy share URL"
                title="Copy share URL"
                className="shrink-0"
              >
                {copied ? '✓' : '⧉'}
              </Btn>
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
                <Btn
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
                </Btn>
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

          <Panel className="p-4 sm:p-5">
            <h2 className={PANEL_HEADING_CLASS}>QR code</h2>
            <div className="flex items-center gap-3.5">
              {/* TODO(post-beta): render a real QR for the share URL — needs a
                  zero-dependency QR encoder; until then this is the design's
                  checker placeholder (§3.4). */}
              <div
                aria-hidden="true"
                className="h-[84px] w-[84px] shrink-0 rounded-[3px] border-chrome border-ink"
                style={{
                  background:
                    'repeating-conic-gradient(var(--color-ink) 0 25%, #fff 0 50%) 0 / 16px 16px',
                }}
              />
              <p className="text-wk-muted mb-0 font-body text-caption">Scan to open</p>
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
            <MChip label="Callsign" value={`“${pilot.callsign}”`} variant="call" />
            <MChip label="Class" value={resolveClassName(pilot.classRef)} variant="class" />
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
            <StatBlock
              code="HP"
              name="Hit Points"
              unit="Points"
              stat="hp"
              max={maxHP}
              value={Math.min(pilot.currentHP ?? maxHP, maxHP)}
              editable={false}
            />
            <StatBlock
              code="AP"
              name="Ability Points"
              unit="Points"
              stat="ap"
              max={maxAP}
              value={Math.min(pilot.currentAP ?? maxAP, maxAP)}
              editable={false}
            />
            <StatBlock
              code="TP"
              name="Training"
              unit="Points"
              value={pilot.trainingPoints ?? 0}
              editable={false}
            />
          </>
        }
      />
    )
  }

  if (kind === 'mech') {
    const mech = entity as Mech
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === mech.chassisRef) ?? null
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
            <MChip label="Chassis" value={chassis?.name ?? mech.chassisRef} variant="class" />
            {chassis && typeof chassis.techLevel === 'number' && (
              <MChip label="Tech LV" value={chassis.techLevel} />
            )}
          </>
        }
        identity={mech.patternName ? [{ label: 'Pattern', value: mech.patternName }] : []}
        specs={<ChassisStats items={specs} />}
        trackers={
          <>
            <StatBlock
              code="Structure"
              name="Points"
              unit="Points"
              stat="sp"
              max={maxSP}
              value={Math.min(mech.currentSP ?? maxSP, maxSP)}
              editable={false}
            />
            <StatBlock
              code="Energy"
              name="Points"
              unit="Points"
              stat="ep"
              max={maxEP}
              value={Math.min(mech.currentEP ?? maxEP, maxEP)}
              editable={false}
            />
            <StatBlock
              code="Heat"
              name="Capacity"
              unit="Heat"
              stat="heat"
              max={maxHeat}
              value={Math.min(mech.currentHeat ?? maxHeat, maxHeat)}
              editable={false}
            />
            <StatBlock
              code="Cargo"
              name="Slots"
              unit="Slots"
              stat="cargo"
              max={maxCargo}
              value={totalLotUnits(mech.cargoLots)}
              editable={false}
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
      meta={tl !== undefined ? <MChip label="Tech LV" value={tl} /> : undefined}
      trackers={
        <>
          <StatBlock
            code="Structure"
            name="Points"
            unit="Points"
            stat="sp"
            max={maxSP}
            value={Math.min(crawler.currentSP ?? maxSP, maxSP)}
            editable={false}
          />
          {states.length > 0 && (
            <StatBlock code="Bays" name="Condition" unit="Bays" states={states} />
          )}
        </>
      }
    />
  )
}
