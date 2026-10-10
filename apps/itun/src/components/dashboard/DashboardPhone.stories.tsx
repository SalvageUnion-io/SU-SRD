import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
// The components import no CSS; the app (or story) loads the bundle.
import '../../styles/dashboard.css'
import type { PhoneUnit } from './DashboardPhone'
import { DashboardPhone } from './DashboardPhone'
import type { DeckListModel } from './DeckList'
import { DashboardFormContext } from './dashboardForm'
import type { MajorModel } from './MajorFrame'
import { MajorFrame } from './MajorFrame'
import { PhoneDeck } from './PhoneDeck'
import { PhoneResolve } from './PhoneResolve'
import type { SlotKind } from './slotLayout'

export default { title: 'Compositions/Dashboard/Phone' }

/*
 * The Dashboard's phone form (ADR-043, issue 1256): board D4 (the Mech tab)
 * and board D5 (resolving). The frames are the real presentational halves
 * over fixture models with inert handlers; the store-wired Majors need the
 * app's stores.
 */

const ignore = () => {}

const PHONE: CSSProperties = {
  width: 390,
  minHeight: 844,
  border: '1px solid var(--color-ink-20)',
  overflow: 'hidden',
}

const TABS = ['All', 'Turn', 'Short', 'Long', 'Free', 'React'] as const
const RANGES = ['Close', 'Medium', 'Long', 'Far'] as const

function deck(): DeckListModel {
  const actions = SalvageUnionReference.Actions.all().slice(0, 4)
  return {
    kind: 'list',
    tabs: TABS,
    activeTab: 'All',
    onTab: ignore,
    rangeBands: RANGES,
    activeRange: 'Close',
    onRange: ignore,
    reachText: '3 / 4 in reach',
    sources: [],
    sourceFilter: null,
    onSourceFilter: ignore,
    familyClass: 'pc-deck-fam-mech',
    rows: actions.map((action, i) => ({
      key: `act-${action.id}`,
      entity: action,
      name: action.name,
      locked: i === actions.length - 1,
      lockTitle: i === actions.length - 1 ? 'Out of range / overheat' : undefined,
    })),
    onOpen: ignore,
    onActivate: ignore,
  }
}

/** The Scrapper boarded, as `MechMajor` builds it in the phone form. */
const SCRAPPER: MajorModel = {
  fam: 'mech',
  stampLabel: 'Boarded',
  bays: [
    {
      label: 'Pools',
      gauges: [
        { label: 'SP', value: 9, max: 9, tone: 'mech' },
        { label: 'EP', value: 9, max: 9, tone: 'mech' },
      ],
      buttons: [],
    },
    {
      label: 'Reactor',
      gauges: [{ label: 'Heat', value: 0, max: 8, tone: 'mech', danger: 6 }],
      buttons: [
        { label: 'Push · +2 Heat', onClick: ignore, variant: 'go' },
        { label: 'Vent', onClick: ignore, variant: 'go' },
        { label: 'Heat Check', onClick: ignore },
        { label: 'Shut Down', onClick: ignore },
        { label: 'Take Damage', onClick: ignore },
        { label: 'Storage · 0/6', onClick: ignore },
      ],
    },
    {
      label: 'Egress',
      side: true,
      buttons: [
        { label: 'Dismount', onClick: ignore, variant: 'go' },
        { label: 'Eject', onClick: ignore, variant: 'danger' },
      ],
    },
  ],
}

function placeholder(name: string): PhoneUnit {
  return { name, problems: [], body: <p>{name}’s controls</p> }
}

/** Board D4: the Mech tab, the deck below the Reactor, a Minor's warning on Pilot. */
export const MechTab = () => {
  const [tab, setTab] = useState<SlotKind>('mech')
  const units: Record<SlotKind, PhoneUnit> = {
    pilot: { ...placeholder('Bonesaw'), problems: ['Minor injury'] },
    mech: {
      name: 'Scrapper',
      problems: [],
      body: (
        <DashboardFormContext
          value={{
            form: 'phone',
            between: <PhoneDeck view={deck()} onOpen={ignore} onActivate={ignore} />,
          }}
        >
          <MajorFrame view={SCRAPPER} />
        </DashboardFormContext>
      ),
    },
    crawler: placeholder('Tenacity'),
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Caption>
        Board D4 — the Mech tab on a phone. Pick Pilot or Crawler to see the pinned vitals.
      </Caption>
      <div className="pc-root su-dash-phone" style={PHONE}>
        <DashboardPhone
          gameName="Reclamation"
          homeHref="/"
          major="mech"
          mountKey="mech:scrapper"
          mountNote="Boarded Scrapper"
          tab={tab}
          onTab={setTab}
          units={units}
          pinned={[
            { label: 'SP', value: 9, max: 9 },
            { label: 'EP', value: 9, max: 9 },
            { label: 'Heat', value: 0, max: 8 },
          ]}
          readOnly={null}
          resume={null}
          resolveScreen={null}
          opener={null}
          crewAttention={false}
          inbox={1}
          onSearch={ignore}
          onMenu={ignore}
          menu={null}
        />
      </div>
    </div>
  )
}

/** Board D5: resolving an action, rolled to a Success, Push and Apply offered. */
export const Resolving = () => {
  const action = SalvageUnionReference.Actions.all()[0]
  const success = CORE_ROLL_BANDS.success
  if (!action) return <Caption>No actions in the reference set.</Caption>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Caption>Board D5 — resolving on a phone: only the next step at the bottom.</Caption>
      <div className="pc-root su-dash-phone" style={PHONE}>
        <PhoneResolve
          view={{
            kind: 'resolve',
            onBack: ignore,
            costLabel: '1 EP',
            currency: 'EP',
            entity: action,
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
              bandLabel: success.label,
              bandSummary: success.summary,
              destructive: false,
            },
            pushLog: null,
            meltdown: null,
            applied: false,
            applyRouted: false,
          }}
          vitals={[
            { label: 'Heat', value: 3, max: 8 },
            { label: 'EP', value: 6, max: 9 },
          ]}
          readOnly={null}
          onBack={ignore}
          onTakeHit={ignore}
        />
      </div>
    </div>
  )
}
