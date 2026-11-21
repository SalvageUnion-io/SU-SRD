/**
 * CompanionSheet: a companion's own sheet, at
 * `/mechs/:id/companions/:partnerId` (and a pilot's). The data stays where it
 * is: a companion is an entry of its host's `partners`, read and written
 * through the host.
 *
 * The band in the companion's own paint (a drone wears its tech level) with
 * "Companion of <host>" linking back; the masthead (art, SP · EP · Heat live,
 * the slot tallies and its short lines, About at the right); then its
 * abilities, Systems and Modules as tables whose rows open in place, Cargo in
 * the side column, and the cite.
 *
 * `CompanionSheetView` is both routes' page body: the host is located as any
 * sheet is (`useLocatedSheet`). Your own host's companion steps live where the
 * session may write (`useSync().canWrite`); a crewmate's is read from the
 * Game's listing (`makeReadOnlySheetStore`) and is a read-out. Fitting a
 * loadout stays on the host's Edit card.
 */

import { sheetPath } from 'game-domain/entityKinds'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { getAssetUrl, STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { installedSlots, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { OpenColumn, OpenRow, PhoneVital } from '../../components/index'
import {
  ChapterBand,
  Chips,
  capsLabel,
  Facts,
  Mention,
  OpenLedger,
  Prose,
  relation,
  STRIP_ART,
  Strip,
  StripFigure,
  Tag,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { space } from '../../design/tokens'
import { bandFillFor } from '../../lib/chapters'
import { cn } from '../../lib/cn'
import { replacePartner } from '../../lib/partnerLookup'
import { buildCompanionActions } from '../../lib/rules/actionList'
import {
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useSync } from '../../replica/syncContext'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { partnerDisplayName } from '../sheet/partnerDisplay.model'
import { makeReadOnlySheetStore, sheetDataFromListing } from '../sheet/readOnlySheetStore.model'
import { SheetFallback } from '../sheet/SheetFallback'
import { SHEET_VITALS } from '../sheet/sheetVitals.model'
import { useLocatedSheet } from '../sheet/useLocatedSheet'
import { Cost } from './Cost'
import { Dash, DashColumn } from './Dash'
import { ITEM_COLUMNS, itemRows } from './itemRows'
import { RowRules } from './RowRules'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const ABILITY_COLUMNS: readonly OpenColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text', phone: true },
  { key: 'cost', label: buildSheetCopy('cost'), phone: true },
]

const CARGO_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'slots', label: buildSheetCopy('slots'), phone: true },
]

// The page is as tall as its content; `#root`'s
// column keeps a short page's foot on the window's edge.
const ROOT = { background: 'var(--color-wk-bg)' } satisfies CSSProperties

const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
} satisfies CSSProperties

const NO_CHIPS = { durations: [], facts: [], tags: [] }

type Props = { hostKind: 'mech' | 'pilot'; hostId: string; partnerId: string }

/**
 * A companion's page, `/pilots/:id/companions/:partnerId` and
 * `/mechs/:id/companions/:partnerId` alike: the host located as its own sheet
 * is (yours, a crewmate's, or not found), then the companion read through it.
 */
export function CompanionSheetView({ hostKind, hostId, partnerId }: Props) {
  const { canWrite } = useSync()
  const { status, listing, crew } = useLocatedSheet(hostKind, hostId)
  const listed = useMemo(
    () => (listing ? makeReadOnlySheetStore(sheetDataFromListing(listing)) : null),
    [listing]
  )
  if (status === 'yours') {
    return (
      <CompanionSheet
        hostKind={hostKind}
        hostId={hostId}
        partnerId={partnerId}
        store={useUnits}
        writes={canWrite}
      />
    )
  }
  if (status !== 'listed' || listed === null) {
    return (
      <SheetFallback
        kind={hostKind}
        status={status === 'listed' ? 'loading' : status}
        back={crew}
      />
    )
  }
  return (
    <CompanionSheet
      hostKind={hostKind}
      hostId={hostId}
      partnerId={partnerId}
      store={listed}
      writes={false}
    />
  )
}

export function CompanionSheet({
  hostKind,
  hostId,
  partnerId,
  store,
  writes,
}: Props & {
  /** Where the host is read: the replica (yours), or the Game's listing (a crewmate's). */
  store: UnitsStore
  /** The viewer may write the host now: SP, EP and Heat step. */
  writes: boolean
}) {
  const storeState = store()
  const host = storeState.get(hostKind, hostId)
  const partner = (host?.partners ?? []).find((each) => each.id === partnerId)
  const block = partner ? resolvePartnerStatBlock(partner) : null
  // An app path: the surface's router link adds the app's base.
  const hostHref = sheetPath(hostKind, hostId)

  if (!host || !partner || !block) {
    return (
      <NotFoundPanel
        title={buildSheetCopy('noSuchCompanion')}
        message={buildSheetCopy('companionGone', { kind: hostKind })}
        back={{ href: hostHref, label: buildSheetCopy('backToItsHost', { kind: hostKind }) }}
      />
    )
  }

  const entity = block as RefMetaEntity
  const model = toEntityModel(entity)
  const name = partnerDisplayName(partner)
  const hostName = 'callsign' in host && host.callsign.trim() !== '' ? host.callsign : host.name
  const max = partnerDerivedStats(partner, partnerTechLevel(partner, undefined))
  const patch = (fields: Partial<PartnerInstance>) =>
    runWrite(() =>
      storeState.update(
        hostKind,
        hostId,
        { partners: replacePartner(host?.partners, partner.id, fields) },
        LIVE_SHEET_MANUAL
      )
    )
  const step = (field: 'currentSP' | 'currentEP' | 'currentHeat') =>
    writes ? { onChange: (next: number) => patch({ [field]: next }) } : {}
  const vitals: PhoneVital[] = [
    {
      key: 'sp',
      label: SHEET_VITALS.sp.short,
      name: SHEET_VITALS.sp.label,
      value: resolvePool(partner.currentSP, max.structurePoints),
      max: max.structurePoints,
      ...step('currentSP'),
    },
    {
      key: 'ep',
      label: SHEET_VITALS.ep.short,
      name: SHEET_VITALS.ep.label,
      value: resolvePool(partner.currentEP, max.energyPoints),
      max: max.energyPoints,
      ...step('currentEP'),
    },
    {
      key: 'heat',
      label: SHEET_VITALS.heat.short,
      name: SHEET_VITALS.heat.label,
      value: resolveGauge(partner.currentHeat),
      max: max.heatCapacity,
      ...step('currentHeat'),
    },
  ]

  // Its integrated hardware (a drone's Hover Locomotion) was seeded into its
  // own lists when it was granted, so they are the whole loadout.
  const fitted = {
    systems: partner.systems,
    modules: partner.modules,
    systemConditions: partner.systemConditions,
    moduleConditions: partner.moduleConditions,
    itemUses: partner.itemUses,
  }
  const systems = itemRows(fitted, 'system')
  const modules = itemRows(fitted, 'module')
  const lots = partner.cargoLots ?? []
  const cargoUsed = lots.reduce((sum, lot) => sum + lot.units, 0)

  const allActions = buildCompanionActions({ kind: hostKind, id: hostId }, [partner])
  const abilityRows: OpenRow[] = allActions
    .filter((action) => action.kind === 'chassis')
    .map((action) => {
      const actionModel = toEntityModel(action.action)
      return {
        id: action.key,
        name: action.name,
        entityRef: actionModel.ref,
        cells: [
          actionModel.actionType ?? '',
          actionModel.cost ? <Cost key="cost" cost={actionModel.cost} /> : '',
        ],
        detail: <RowRules entity={action.action} />,
      }
    })

  const art = getAssetUrl(entity)
  const content = 'content' in block && Array.isArray(block.content) ? block.content : []
  const about = content
    .map((each) => (typeof each === 'object' && each && 'value' in each ? String(each.value) : ''))
    .filter(Boolean)
    .join('\n\n')
  const lines = [
    { key: 'ai', label: 'A.I. Personality', value: partner.aiPersonality },
    { key: 'look', label: buildSheetCopy('appearance'), value: partner.appearance },
  ].filter((line) => line.value && line.value.trim() !== '')
  const cite =
    'source' in block && typeof block.source === 'string'
      ? `${block.source.replace(/^Salvage Union /, '')}${'page' in block && block.page ? ` · p.${block.page}` : ''}`
      : undefined
  const sysMax = max.systemSlots
  const modMax = max.moduleSlots
  const slots = installedSlots(fitted)
  const sysUsed = slots.systems
  const modUsed = slots.modules

  const fill = bandFillFor(partner.hostSchema, block) ?? 'var(--color-tl-1)'

  return (
    <main
      className="su-sheet--mech su-page-gutters su-companion-sheet"
      data-variant="mech"
      style={{ ...ROOT, '--sheet-tone': fill } as CSSProperties}
    >
      <ChapterBand
        tone="mech"
        fill={fill}
        asideAt="notch"
        aside={
          <Chips
            className="su-entity-stamps su-sheet-band-stamps"
            size="compact"
            chips={NO_CHIPS}
            nodes={{
              relation: (
                <>
                  <Tag
                    tag={relation('host', buildSheetCopy('companionOf'), hostName, {
                      href: hostHref,
                    })}
                    linkable
                    wrap
                  />
                  <Tag
                    tag={relation(
                      'stamp',
                      partner.hostSchema === 'drones' ? 'Drone' : 'Equipment',
                      model.title,
                      {
                        ref: model.ref,
                      }
                    )}
                    linkable
                    wrap
                  />
                </>
              ),
            }}
          />
        }
      >
        {name}
      </ChapterBand>
      <div className="su-sheet-live-body">
        <section className="su-sheet-section" style={SHEET}>
          <Strip
            label={buildSheetCopy('unitVitals', { name })}
            art={
              <EntityPhoto
                photo={undefined}
                fallback={art ? { url: art, alt: `${model.title} artwork` } : undefined}
                name={name}
                frame={STRIP_ART}
              />
            }
            vitals={vitals}
            figures={
              <>
                <StripFigure
                  label={STAT_LABELS.systemSlots.short}
                  name={STAT_LABELS.systemSlots.label}
                  value={sysUsed}
                  max={sysMax}
                  meter="pips"
                  tint="ink"
                  over={sysUsed > sysMax}
                />
                <StripFigure
                  label={STAT_LABELS.moduleSlots.short}
                  name={STAT_LABELS.moduleSlots.label}
                  value={modUsed}
                  max={modMax}
                  meter="pips"
                  tint="ink"
                  over={modUsed > modMax}
                />
                <StripFigure
                  label={STAT_LABELS.cargoCapacity.short}
                  name={STAT_LABELS.cargoCapacity.label}
                  value={cargoUsed}
                  max={max.cargoCapacity}
                  meter="pips"
                  tint="cargo"
                  over={cargoUsed > max.cargoCapacity}
                />
              </>
            }
            traits={
              <Facts
                className="su-mast-traits"
                itemClassName="su-mast-trait"
                labelClassName="su-mast-id__label"
                facts={[
                  {
                    key: 'tech-level',
                    label: buildSheetCopy('techLevel'),
                    value: <TechLevel level={partnerTechLevel(partner, undefined)} />,
                  },
                  ...lines,
                ]}
              />
            }
            identity={
              about !== '' ? (
                <div className="su-mast-id">
                  <div className="su-mast-id__about">
                    <p className={cn('su-mast-id__label', CAPS, CAPS)}>{buildSheetCopy('about')}</p>
                    <Prose text={about} lines={5} />
                  </div>
                </div>
              ) : undefined
            }
          />
          <Dash>
            <DashColumn wide label={name}>
              {abilityRows.length > 0 && (
                <OpenLedger
                  title={buildSheetCopy('abilities')}
                  columns={ABILITY_COLUMNS}
                  groups={[{ key: 'abilities', rows: abilityRows }]}
                />
              )}
              <OpenLedger
                title={buildSheetCopy('systems')}
                tally={{ label: buildSheetCopy('slots'), value: sysUsed, max: sysMax }}
                columns={ITEM_COLUMNS}
                groups={[{ key: 'systems', rows: systems }]}
                empty={buildSheetCopy('nothingFitted')}
              />
              <OpenLedger
                title={buildSheetCopy('modules')}
                tally={{ label: buildSheetCopy('slots'), value: modUsed, max: modMax }}
                columns={ITEM_COLUMNS}
                groups={[{ key: 'modules', rows: modules }]}
                empty={buildSheetCopy('nothingFitted')}
              />
            </DashColumn>
            <DashColumn label={buildSheetCopy('whatCarries', { name })}>
              <div className="su-dash-group">
                <OpenLedger
                  title={buildSheetCopy('cargo')}
                  tally={{
                    label: buildSheetCopy('slots'),
                    value: cargoUsed,
                    max: max.cargoCapacity,
                  }}
                  columns={CARGO_COLUMNS}
                  groups={[
                    {
                      key: 'lots',
                      rows: lots.map((lot) => ({
                        id: lot.id,
                        name: lot.name,
                        cells: ['', lot.units],
                      })),
                    },
                  ]}
                  empty={buildSheetCopy('nothingInTheHold')}
                  cite={
                    cite ? (
                      <>
                        <Mention entityRef={model.ref}>{model.title}</Mention> · {cite}
                      </>
                    ) : undefined
                  }
                />
              </div>
            </DashColumn>
          </Dash>
        </section>
      </div>
    </main>
  )
}
