import { borderWidth, color, font, fontSize, radius, space } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import '../../styles/entityRow.css'
import { EntityRow } from './EntityRow'

export default {
  title: 'Compositions/Catalog/Entity Row',
}

// The mech row is a LIVE chassis fixture (name + pattern + TL/SP straight from
// the ORM). The pilot and crawler are player-build shapes — no reference entity
// backs a saved pilot/crawler instance — so they're named from real SU data
// (a real Class, a real Crawler type) with player-side vitals.
const mech = SalvageUnionReference.Chassis.all()[0]
const pilotClass = SalvageUnionReference.Classes.all()[0]
const crawlerType = SalvageUnionReference.Crawlers.all()[0]

/** The story frame: a 28rem paper column. */
const FRAME = {
  backgroundColor: color.paper,
  maxWidth: '28rem',
  padding: space[20],
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
} satisfies CSSProperties

const LIST = { ...COLUMN, listStyleType: 'none' } satisfies CSSProperties

const CREATE_LINK = {
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  paddingBlock: space[4],
  paddingInline: space[12],
  textAlign: 'center',
  textDecorationLine: 'none',
} satisfies CSSProperties

/**
 * A roster column: three saved builds — a pilot, a mech, and a crawler — each a
 * header-only listing row keyed to its ontology tone. The mech reads live from
 * the first chassis fixture; the pilot/crawler are player builds named from a
 * real Class and Crawler type.
 */
export const Default: Story = () => (
  <div style={FRAME}>
    <ul style={LIST}>
      <li>
        <EntityRow
          entityType="pilot"
          name="Ace"
          meta={pilotClass?.name ?? 'Pilot'}
          stats={[{ label: 'HP', value: 16 }]}
          sheetHref="#/pilot/ace"
        />
      </li>
      <li>
        <EntityRow
          entityType="mech"
          name={`${mech?.name ?? 'Mule'} — ${mech?.patterns?.[0]?.name ?? 'Hauler Pattern'}`}
          stats={[
            { label: 'TL', value: mech?.techLevel ?? 1 },
            { label: 'SP', value: mech?.structurePoints ?? 12 },
          ]}
          sheetHref="#/mech/mule"
        />
      </li>
      <li>
        <EntityRow
          entityType="crawler"
          name={crawlerType?.name ?? 'Union Crawler'}
          stats={[
            { label: 'TL', value: 1 },
            { label: 'SP', value: 20 },
          ]}
          sheetHref="#/crawler/hamlet"
        />
      </li>
    </ul>
  </div>
)

/**
 * The `empty` variant — a dashed placeholder slot for an unfilled link. Keeps
 * the ontology tone wash + a black role tab and the default per-ontology
 * missing-entity glyph, over a helper message and optional create action.
 */
/**
 * The `game` ontology (ADR-030) — a shared table, listed as a peer of the
 * player builds. Blue rail, and three toned badges instead of one: the Game's
 * communal crawler, its pilot count, its mech count. `meta` takes an array to
 * carry them.
 */
export const Game: Story = () => (
  <div style={FRAME}>
    <ul style={LIST}>
      <li>
        <EntityRow
          entityType="game"
          name="Union Crawler #430"
          meta={[crawlerType?.name ?? 'Crawler', '4 Pilots', '3 Mechs']}
          metaLine="Mediator · started from the Starter Set"
          sheetHref="#/games/430"
        />
      </li>
      <li>
        {/* A brand-new Game: no crawler yet and nothing built, so the counts
            read zero rather than the badges vanishing. */}
        <EntityRow
          entityType="game"
          name="Thursday Night Salvage"
          meta={['No crawler', '0 Pilots', '0 Mechs']}
          metaLine="Player · organised by Vex"
          sheetHref="#/games/thursday"
        />
      </li>
    </ul>
  </div>
)

export const Empty: Story = () => (
  <div style={{ ...FRAME, ...COLUMN }}>
    <EntityRow
      empty
      entityType="game"
      roleLabel="Game"
      message="You are not in any games yet — start one, or join with a code."
    />
    <EntityRow
      empty
      entityType="mech"
      roleLabel="Assigned Mech"
      message="No mech assigned — build one to track its loadout and heat from here."
      actions={
        <a href="#/mech/new" style={CREATE_LINK}>
          + Create
        </a>
      }
    />
    <EntityRow
      empty
      entityType="crawler"
      roleLabel="Home Crawler"
      message="No crawler linked — the assigned pilot's home crawler appears here."
    />
  </div>
)
