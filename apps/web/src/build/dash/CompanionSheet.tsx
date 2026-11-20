/**
 * CompanionSheet — MOCK (best, revision 6, owner 2026-11-19): a companion's
 * own sheet, at `/mechs/:id/companions/:partnerId` (and a pilot's).
 *
 * The owner's ruling brings a companion's sheet back (ADR-028 retired it, so
 * that ADR needs amending). The data stays where it is: a companion is an
 * entry of its host's `partners`, read and written through the host.
 *
 * The Best sheet anatomy: the band in the companion's own paint (a drone
 * wears its tech level) with "Companion of <host>" linking back; the masthead
 * (art, SP · EP · Heat live, the slot tallies and its short lines, About at
 * the right); Sheet | Actions; then its abilities, Systems and Modules as
 * tables whose rows open in place, Cargo in the side column, and the cite.
 *
 * MOCK shortcuts: it reads only the viewer's own host (a crewmate's companion
 * is not resolved); fitting a
 * loadout stays on the host's Edit card.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { getAssetUrl, STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { installedSlots, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { PhoneVital } from '../../components/index'
import { ChapterBand, Chips, Mention, relation, Tag } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { appPath } from '../../lib/appBase'
import { bandFillFor } from '../../lib/chapters'
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
import { useUnits } from '../../replica/units'
import { partnerDisplayName } from '../sheet/partnerDisplay.model'
import { SHEET_VITALS } from '../sheet/sheetVitals.model'
import { Cost } from './Cost'
import { Dash, DashColumn, Prose } from './Dash'
import { ITEM_COLUMNS, itemRows } from './itemRows'
import type { OpenColumn, OpenRow } from './OpenLedger'
import { OpenLedger, TechLevel } from './OpenLedger'
import { RowRules } from './RowRules'
import { STRIP_ART, Strip, StripFigure } from './Strip'

const ABILITY_COLUMNS: readonly OpenColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text', phone: true },
  { key: 'cost', label: buildSheetCopy('cost'), phone: true },
]

const CARGO_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'slots', label: buildSheetCopy('slots'), phone: true },
]

// MOCK (best, revision 7): the page is as tall as its content; `#root`'s
// column keeps a short page's foot on the window's edge.
const ROOT = { background: 'var(--color-wk-bg)' } satisfies CSSProperties

const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
} satisfies CSSProperties

const NO_CHIPS = { durations: [], facts: [], tags: [] }

type Props = { hostKind: 'mech' | 'pilot'; hostId: string; partnerId: string }

export function CompanionSheet({ hostKind, hostId, partnerId }: Props) {
  const storeState = useUnits()
  const host = storeState.get(hostKind, hostId)
  const partner = (host?.partners ?? []).find((each) => each.id === partnerId)
  const block = partner ? resolvePartnerStatBlock(partner) : null
  const hostHref = `${appPath(`/${hostKind}s/${hostId}`)}`

  if (!host || !partner || !block) {
    return (
      <>
        <ChapterBand tone={hostKind === 'mech' ? 'mech' : 'pilot'}>
          {buildSheetCopy('companion')}
        </ChapterBand>
        <p className="su-open__empty">
          No such companion. <a href={hostHref}>Back to its {hostKind}</a>
        </p>
      </>
    )
  }

  const entity = block as RefMetaEntity
  const model = toEntityModel(entity)
  const name = partnerDisplayName(partner)
  const hostName = 'callsign' in host && host.callsign.trim() !== '' ? host.callsign : host.name
  const max = partnerDerivedStats(partner, partnerTechLevel(partner, undefined))
  const writes = host?.partners?.some((each) => each.id === partner.id) === true
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
                    tag={relation('host', 'Companion of', hostName, {
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
              <dl className="su-mast-traits">
                <div className="su-mast-trait">
                  <dt className="su-mast-id__label">{buildSheetCopy('techLevel')}</dt>
                  <dd>
                    <TechLevel level={partnerTechLevel(partner, undefined)} />
                  </dd>
                </div>
                {lines.map((line) => (
                  <div key={line.key} className="su-mast-trait">
                    <dt className="su-mast-id__label">{line.label}</dt>
                    <dd>{line.value}</dd>
                  </div>
                ))}
              </dl>
            }
            identity={
              about !== '' ? (
                <div className="su-mast-id">
                  <div className="su-mast-id__about">
                    <p className="su-mast-id__label">{buildSheetCopy('about')}</p>
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
                empty="Nothing fitted."
              />
              <OpenLedger
                title={buildSheetCopy('modules')}
                tally={{ label: buildSheetCopy('slots'), value: modUsed, max: modMax }}
                columns={ITEM_COLUMNS}
                groups={[{ key: 'modules', rows: modules }]}
                empty="Nothing fitted."
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
