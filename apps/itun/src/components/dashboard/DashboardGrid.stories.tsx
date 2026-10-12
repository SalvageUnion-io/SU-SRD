import { buttonVariants, heatDangerFrom, tokens } from 'component-lib'
import { borderWidth, color } from 'component-lib/design/tokens'
import { Caption } from 'component-lib/stories/harness'
import { ChevronLeft } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CORE_ROLL_BANDS, coreRollBandLabel } from 'salvageunion-reference/rules'
// The components import no CSS; the app (or story) loads the bundle.
import '../../styles/dashboard.css'
import { coreMechanicRowText } from '../../lib/rules/playActions'
import { crawlerFixture, mechFixture, pilotFixture } from '../__tests__/fixtures'
import { DashboardCanvas } from './DashboardCanvas'
import { DashboardGrid } from './DashboardGrid'
import { DashboardStrip } from './DashboardStrip'
import { DeckList } from './DeckList'
import type { DisplayTab } from './DisplayTabs'
import { DisplayTabs } from './DisplayTabs'
import type { MajorModel } from './MajorFrame'
import { MajorFrame } from './MajorFrame'
import { MinorFrame } from './MinorFrame'
import { RailBar } from './RailBar'
import { ResolvePanel } from './ResolvePanel'
import { crawlerMinorModel, mechStats, pilotMinorModel } from './slots.model'

const STACK_12 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

export default { title: 'Compositions/Dashboard/Grid' }

/**
 * The three-region scaffold (rail / primary / display) inside the scaled
 * canvas. Slots stand in for the store-wired instruments (RailBar, the slot
 * row, DisplayPanel). `data-mount="mech"` tints the rail green.
 */
export const Default = () => (
  <div style={STACK_12}>
    <Caption>Three-region layout: rail (top), the slot row (mid), display (bottom).</Caption>
    <div style={{ height: 520, resize: 'both', overflow: 'hidden', border: '1px solid #ccc' }}>
      <DashboardCanvas>
        <DashboardGrid
          mount="mech"
          rail={
            <span
              style={{
                background: 'var(--color-sheet-mech-deep)',
                color: '#fff',
                fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif",
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: 13,
                padding: '5px 9px 6px',
                borderRadius: 2,
              }}
            >
              Mech · Iron Mongrel
            </span>
          }
          primary={<div className="su-dash-placeholder">Slot row · Major + two Minors</div>}
          display={<div className="su-dash-fill">Display · Actions / Tables / SRD</div>}
        />
      </DashboardCanvas>
    </div>
  </div>
)

/*
 * A populated board: the same three regions filled with the real
 * presentational halves (RailBar, MajorFrame and MinorFrames over the slot
 * models, DeckList beside DisplayTabs with a ResolvePanel, DashboardStrip),
 * laid out as `Dashboard.tsx` lays them out. Fixture entities and inert
 * handlers stand in for the stores, which only the app has.
 */

const ignore = () => {}

const ROOK = pilotFixture({
  id: 'story-rook',
  name: 'Rook',
  classRef: 'salvager',
  currentHP: 7,
  currentAP: 3,
  abilities: ['squeeze-it-in'],
})
const SCRAPPER = mechFixture({
  id: 'story-scrapper',
  name: 'Scrapper',
  // A slug, as a stored mech carries it (`resolveChassisRef`), so the
  // Majors derive the Mule's real maxima.
  chassisRef: 'mule',
  currentSP: 6,
  currentHeat: 3,
  currentEP: 4,
})
const HEN = crawlerFixture({
  id: 'story-hen',
  name: 'Mother Hen',
  techLevel: 'tech-2',
  currentSP: 17,
  scrapPool: { tl1: 12, tl2: 4 },
  crawlerBays: [{ bayRef: 'mech-bay' }, { bayRef: 'med-bay' }, { bayRef: 'crafting-bay' }],
})

const btn = (label: string, variant?: 'danger' | 'go') => ({ label, onClick: ignore, variant })

/** The boarded Mech Major, its numbers derived as `SlotMajor` derives them. */
function boardedMech(): MajorModel {
  const s = mechStats(SCRAPPER, ROOK.abilities, [])
  return {
    fam: 'mech',
    stampLabel: 'Boarded',
    bays: [
      {
        label: 'Reactor',
        large: true,
        gauges: [
          {
            label: 'Heat',
            value: s.heat,
            max: s.maxHeat,
            tone: 'mech',
            danger: s.maxHeat > 0 ? heatDangerFrom(s.maxHeat) : undefined,
          },
          { label: 'EP', value: s.ep, max: s.maxEP, tone: 'mech' },
        ],
        buttons: [btn('Push', 'go'), btn('Heat Check', 'go'), btn('Vent', 'go'), btn('Shut Down')],
      },
      {
        label: 'Chassis',
        large: true,
        gauges: [
          { label: 'SP', value: s.sp, max: s.maxSP, tone: 'mech' },
          { label: 'Cargo', value: s.cargo, max: s.maxCargo, tone: 'mech' },
        ],
        buttons: [btn('Take Damage'), btn('Storage')],
      },
      { label: 'Effects', side: true, columns: 1, buttons: [btn('○ Squeeze it in')] },
      { label: 'Egress', side: true, buttons: [btn('Dismount', 'go'), btn('Eject', 'danger')] },
    ],
  }
}

/** The slot row's grid, as `SlotRow` places a Major and two Minors. */
const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 236px 236px',
  gap: '10px',
  height: '100%',
}

/** `Dashboard.tsx`'s display region: deck and tabs side by side, the strip below. */
const DISPLAY: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}
const DECK_AND_TABS: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
}
const DECK: CSSProperties = {
  minHeight: 0,
  borderRight: `${borderWidth.chrome} solid ${color.ink20}`,
}

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

const TAB_NAMES: Record<Exclude<DisplayTab, 'resolve'>, string> = {
  reference: 'Reference',
  tables: 'Tables',
  srd: 'SRD',
  log: 'Log',
  crew: 'Crew',
}

/**
 * Boarded, mid-turn: the rail, the Mech Major with the Pilot and Crawler as
 * Minors, the deck of real SRD actions beside the Resolve tab (an action
 * rolled to a Success), and the Game's strip with a Mediator alert.
 */
export const Populated = () => {
  const [tab, setTab] = useState<DisplayTab>('resolve')
  const actions = SalvageUnionReference.Actions.all().slice(0, 6)
  const [first] = actions
  const success = CORE_ROLL_BANDS.success
  const panels = Object.fromEntries(
    Object.entries(TAB_NAMES).map(([key, name]) => [
      key,
      <div key={key} className="su-dash-fill">
        Display · {name}
      </div>,
    ])
  ) as Record<Exclude<DisplayTab, 'resolve'>, ReactNode>
  return (
    <div style={STACK_12}>
      <Caption>A populated board: boarded, an action resolved, an alert from the Mediator.</Caption>
      <div style={{ height: 760, resize: 'both', overflow: 'hidden', border: '1px solid #ccc' }}>
        <DashboardCanvas>
          <DashboardGrid
            mount="mech"
            rail={
              <RailBar
                name={ROOK.name}
                stamp={`Boarded · ${SCRAPPER.name}`}
                fam="mech"
                context="Game · Reclamation of the Wastes"
                returnControl={
                  <a
                    href="#game"
                    aria-label="Back to Reclamation of the Wastes"
                    className={buttonVariants({
                      surface: 'instrument',
                      variant: 'ghost',
                      size: 'iconOnly',
                    })}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </a>
                }
                status={<span>● Saved</span>}
              />
            }
            primary={
              <div style={ROW}>
                <MajorFrame view={boardedMech()} />
                <MinorFrame
                  view={pilotMinorModel(ROOK, HEN, SCRAPPER.name)}
                  slot="Pilot"
                  onExpand={ignore}
                />
                <MinorFrame view={crawlerMinorModel(HEN)} slot="Crawler" onExpand={ignore} />
              </div>
            }
            display={
              <div style={DISPLAY}>
                <div style={DECK_AND_TABS}>
                  <section aria-label="Actions" style={DECK}>
                    <DeckList
                      view={{
                        kind: 'list',
                        tabs: TABS,
                        activeTab: 'All',
                        onTab: ignore,
                        rangeBands: RANGES,
                        activeRange: 'Close',
                        onRange: ignore,
                        reachText: '5 / 6 in reach',
                        sources: [],
                        sourceFilter: null,
                        onSourceFilter: ignore,
                        familyClass: 'su-dash-deck-fam-mech',
                        rows: actions.map((action, i) => ({
                          key: `act-${action.id}`,
                          entity: action,
                          name: action.name,
                          locked: i === actions.length - 1,
                          lockTitle: i === actions.length - 1 ? 'Out of range' : undefined,
                        })),
                        onOpen: ignore,
                        onActivate: ignore,
                      }}
                    />
                  </section>
                  <DisplayTabs
                    tab={tab}
                    onTab={setTab}
                    panels={{
                      resolve: first ? (
                        <ResolvePanel
                          view={{
                            kind: 'resolve',
                            onBack: ignore,
                            costLabel: '1 EP',
                            currency: 'EP',
                            entity: first,
                            controls: {
                              activateLabel: 'Activated',
                              activateDisabled: true,
                              onActivate: ignore,
                              activated: true,
                              onRoll: ignore,
                              push: { disabled: false, pushed: false, onPush: ignore },
                              applyLabel: 'Apply',
                              applyDisabled: false,
                              onApply: ignore,
                              onClear: ignore,
                            },
                            roll: {
                              roll: 14,
                              band: 'success',
                              bandRange: success.range,
                              bandLabel: coreRollBandLabel(success.band),
                              bandSummary: coreMechanicRowText(14),
                              destructive: false,
                            },
                            pushLog: null,
                            applied: false,
                            applyRouted: false,
                          }}
                        />
                      ) : (
                        <Caption>No actions in the reference set.</Caption>
                      ),
                      ...panels,
                    }}
                  />
                </div>
                <DashboardStrip
                  gameName="Reclamation of the Wastes"
                  gameHref="#game"
                  alerts={[{ _id: 'a1', message: 'Storm front closing in. Roll Heat.', ts: 0 }]}
                  inbox={1}
                />
              </div>
            }
          />
        </DashboardCanvas>
      </div>
    </div>
  )
}
