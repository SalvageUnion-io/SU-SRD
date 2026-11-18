/**
 * SheetActions — a Live Sheet's Actions list (R65): every action the unit
 * has, grouped by action type under Mini Slabs in the list's own order
 * (`ACTION_TYPE_ORDER`: Turn, Short, Long, Reaction, Free, Downtime, Passive
 * last), the groups Play's board draws. A mech's are its chassis ability and
 * each installed System's and Module's (`buildMechActions`); a pilot's, their
 * abilities' and equipment's (`buildPilotActions`); each one's companions'
 * follow in their groups (`buildCompanionActions`).
 *
 * A row is the one Play draws (`actionRow`): the owner's picks applied, its
 * text the action's effect alone in at most two lines, a companion's row in
 * its own tone and named by a relation chip (C11); its name Peeks the whole
 * card. Where an action is not named for its item, a chip says the item. The
 * sheet reads here: Use is Play's (ADR-021).
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties } from 'react'
import {
  EmptyState,
  Entity,
  MiniGrid,
  SlabSection,
  Stat,
  TraitProse,
  tokens,
} from '../../components/index'
import type { PlayAction } from '../../lib/rules/actionList'
import {
  buildCompanionActions,
  buildMechActions,
  buildPilotActions,
} from '../../lib/rules/actionList'
import { actionRow } from '../../lib/rules/actionRow'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ACTION_TYPE_ORDER, actionTypeOf } from '../../play/playActions.model'

const GROUPS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/** The Mini's tint: the unit's kind on the colour map. */
type Tint = 'mech' | 'pilot'

/** Under its type's heading, so its head leaves the type out (C10). */
const GROUPED = { grouped: true } as const

function ActionRow({ action, tint }: { action: PlayAction; tint: Tint }) {
  const { model, summary } = actionRow(action, GROUPED)
  const companion = action.companion
  return (
    <li>
      <Entity
        size="mini"
        context="play"
        model={model}
        tint={companion?.tone ?? tint}
        {...(companion
          ? { relations: [{ key: `companion-${companion.id}`, name: companion.name }] }
          : {})}
        instance={action.condition === 'destroyed' ? { condition: 'destroyed' } : undefined}
        // The item it comes from, where its own name does not say it.
        {...(!action.name.includes(action.ownerName)
          ? { state: <Stat size="mini" label={action.ownerName} /> }
          : {})}
        // Contentful, so its head carries range, damage and traits; its text
        // is the short line alone.
        body={{
          text: false,
          children: summary ? (
            <TraitProse as="p" className="su-sheet-act__effect" text={summary} />
          ) : null,
        }}
      />
    </li>
  )
}

type Placement = {
  /**
   * Under its own "Actions" Slab, in a sheet's main column (from 40rem); with
   * no action to list the section is left out (R11). Without it, the list
   * alone: a phone's Actions tab, which its tab names.
   */
  section?: boolean
}

/** A mech's actions and its drones'. */
export function MechActionsList({ mech, section }: { mech: Mech } & Placement) {
  return (
    <SheetActions
      tint="mech"
      section={section}
      actions={[
        ...buildMechActions(mech),
        ...buildCompanionActions({ kind: 'mech', id: mech.id }, mech.partners),
      ]}
    />
  )
}

/** A pilot's actions and their companions'. */
export function PilotActionsList({ pilot, section }: { pilot: Pilot } & Placement) {
  return (
    <SheetActions
      tint="pilot"
      section={section}
      actions={[
        ...buildPilotActions(pilot),
        ...buildCompanionActions({ kind: 'pilot', id: pilot.id }, pilot.partners),
      ]}
    />
  )
}

function SheetActions({
  actions,
  tint,
  section = false,
}: { actions: readonly PlayAction[]; tint: Tint } & Placement) {
  const groups = ACTION_TYPE_ORDER.map((type) => ({
    type,
    actions: actions.filter((a) => actionTypeOf(a.action) === type),
  })).filter((group) => group.actions.length > 0)
  if (groups.length === 0)
    return section ? null : <EmptyState variant="quiet" body={buildSheetCopy('noActionsYet')} />
  const list = (
    <div style={GROUPS}>
      {groups.map((group) => (
        <SlabSection
          key={group.type}
          as={section ? 'h3' : 'h2'}
          size="mini"
          title={group.type}
          count={group.actions.length}
        >
          <MiniGrid label={buildSheetCopy('typeActions', { type: group.type })}>
            {group.actions.map((action) => (
              <ActionRow key={action.key} action={action} tint={tint} />
            ))}
          </MiniGrid>
        </SlabSection>
      ))}
    </div>
  )
  return section ? (
    <SlabSection fold="open" as="h2" title={buildSheetCopy('actions')} count={actions.length}>
      {list}
    </SlabSection>
  ) : (
    list
  )
}
