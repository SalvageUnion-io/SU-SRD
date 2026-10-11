import type { CSSProperties, ReactNode } from 'react'
import type { SURefMetaAction, SURefMetaEntity } from 'salvageunion-reference'
import { extractVisibleActions, SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import { ReferenceEntityCard } from './ReferenceEntityCard'

export default {
  title: 'Compositions/Entity/Reference Entity Actions',
}

/**
 * This story is the SPEC for how actions render (ruleset §5, board E1).
 * Actions are NOT a separate component — an action is `ReferenceEntityCard`
 * rendering an action-shaped entity, and it is a thing you DO, so:
 *
 * - its header is the book's INK BANNER: the title, the cost pennant at the
 *   right, paper flecks — never a ghost of its host's tone (retired);
 * - INSIDE its host it sits inline: a flush band, its "//" line, its body, no
 *   frame and no "Action" stamp;
 * - on its own (the Dashboard deck and resolve panel) it is the same banner in
 *   a frame, and in the Dashboard the pennant IS the action button.
 */

/** Real SRD lookup with a first-entry fallback (data-drift safety). */
function pick<T>(list: T[], predicate: (item: T) => boolean, label: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`Actions story: no ${label} loaded`)
  return found
}

/** Pick a named action off a parent via the same resolver the card uses. */
function actionOf(parent: SURefMetaEntity, actionName: string): SURefMetaAction {
  const actions = extractVisibleActions(parent) ?? []
  return pick(actions, (a) => a.name === actionName, `${actionName} action`)
}

const drill = pick(
  SalvageUnionReference.Systems.all(),
  (s) => s.name === 'Salvaging Drill',
  'system'
)
const scylla = pick(SalvageUnionReference.BioTitans.all(), (b) => b.name === 'Scylla', 'bio-titan')
const engineering = pick(
  SalvageUnionReference.Abilities.all(),
  (a) => a.name === 'Engineering Expertise',
  'ability'
)

const ACTIONS: { label: string; action: SURefMetaAction }[] = [
  { label: 'Salvaging Drill · Auger', action: actionOf(drill, 'Auger') },
  { label: 'Scylla · Scythe Attack', action: actionOf(scylla, 'Scythe Attack') },
  {
    label: 'Engineering Expertise (its self-action)',
    action: actionOf(engineering, 'Engineering Expertise'),
  },
]

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  maxWidth: '36rem',
  padding: space[16],
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
      <Caption>{label}</Caption>
      {children}
    </div>
  )
}

/** Inline, in the card that does them: flush ink bands under the system's body. */
export const Inline: Story = () => (
  <div style={column}>
    <Labelled label="Salvaging Drill — Auger and Drill sit inline, no tray, no stamp">
      <ReferenceEntityCard data={drill} />
    </Labelled>
    <Labelled label="Scylla — a bio-titan's actions, inline (Titanic Actions included)">
      <ReferenceEntityCard data={scylla} size="medium" />
    </Labelled>
  </div>
)

/** On its own: the framed ink banner the Dashboard deck and resolve panel show. */
export const Framed: Story = () => (
  <div style={column}>
    {ACTIONS.map(({ label, action }) => (
      <Labelled key={label} label={label}>
        <ReferenceEntityCard data={action} size="medium" />
      </Labelled>
    ))}
  </div>
)

/**
 * In the Dashboard the cost pennant IS the action button (ruleset §1, board
 * E3): same size, shape and place, filled rust, with a 44px hit area. The
 * Dashboard stays flat, so no speckle.
 */
export const DashboardPennant: Story = () => (
  <div style={{ ...column, backgroundColor: 'var(--color-ink-deep)' }}>
    {ACTIONS.slice(0, 1).map(({ label, action }) => (
      <div key={label} style={{ backgroundColor: 'var(--color-band-cream)', padding: space[12] }}>
        <ReferenceEntityCard
          data={action}
          size="medium"
          texture={false}
          controls={[
            {
              key: 'activate',
              pennant: true,
              ariaLabel: `Activate ${action.name}`,
              onClick: () => {},
            },
          ]}
        />
      </div>
    ))}
  </div>
)

/**
 * The SHORTFORM of an action: one ink pill — the type stamp, the name and the
 * cost pennant (an action with no cost shows none).
 */
export const Badge: Story = () => (
  <div style={{ ...column, alignItems: 'flex-start' }}>
    {ACTIONS.map(({ label, action }) => (
      <Labelled key={label} label={label}>
        <ReferenceEntityCard data={action} size="small" extent="head" />
      </Labelled>
    ))}
  </div>
)
