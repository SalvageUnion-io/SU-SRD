/**
 * CrewLeadMini — a crawler bay's crew lead, inside its bay card: a
 * CONTENTFUL Mini (N3). The bay is a level-1 entity, so its crew lead sits at
 * level 2 and is a Mini (N1), never a titled box (N5).
 *
 * The head is the NPC's: its name, then the role it holds as a relation chip
 * once it has a name of its own (`THE | Doc`, next to the name; R46), so the
 * name alone is the Peek trigger. It Peeks the bay's crew NPC, or
 * opens a built NPC's sheet. The body is what the sheet tracks about them:
 * Keepsake, Motto, Detail and Facts (`NpcLines`), each left out in Read when
 * empty, in Edit their fields, led by the name, which a head cannot hold;
 * and right of them its HP, Mini HP cells in a square block (R46), set by its
 * cells in Edit.
 *
 * Handler absence is the read-only encoding, as on `NpcLines`.
 */

import { useMemo, useState } from 'react'
import type { EntityInstance, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { EntityFormModel, EntityMode } from '../../components/index'
import { Entity, relation, Toggle, VitalGauge } from '../../components/index'
import type { NpcLinesProps } from './NpcLines'
import { NpcLines } from './NpcLines'

type CrewLeadMiniProps = NpcLinesProps & {
  /** Its title on the head (the bay crew's name, else its role); a built NPC's model titles itself. */
  instance?: EntityInstance
  /** Default `read`; a built NPC's head links to its sheet. */
  mode?: EntityMode
  /** The head's Peek address for an NPC with none of its own (`embeddedPeekAddress`). */
  peekAt?: string
} & CrewSource

/** Who heads it: the bay's SRD crew NPC, or a crew lead no reference record describes (`unitRowModel`). */
type CrewSource =
  | { entity: RefMetaEntity; model?: never }
  | { model: EntityFormModel; entity?: never }

/**
 * The head's chips past the role: the model's own, less its book HP, which
 * the head reads live after the role (its state slot in Read, its stepper in
 * the uses slot in Edit), so the role comes first, next to the name. The
 * book's HP hint stays on the reading.
 */
function crewHead(model: EntityFormModel): { model: EntityFormModel; hpHint?: string } {
  const book = model.facts.find((fact) => fact.short === 'HP')
  return {
    model: { ...model, facts: model.facts.filter((fact) => fact.short !== 'HP') },
    ...(book?.hint ? { hpHint: book.hint } : {}),
  }
}

/** Its role as a chip, once it has a name of its own: unnamed, the head's title is the role. */
function roleChip(title: string | undefined, name: string) {
  const named = name.trim() !== '' && name.trim() !== title
  // "THE | Doc": the role it holds, as the book names it.
  return title && named ? [relation('crew-role', 'The', title)] : undefined
}

/** Its lines as Read shows them: no handlers, so each is a row and an empty one is left out. */
function readLines({
  onNameChange: _name,
  onHpChange: _hp,
  onKeepsakeChange: _keepsake,
  onMottoChange: _motto,
  onDetailChange: _detail,
  onFactsChange: _facts,
  ...lines
}: NpcLinesProps): NpcLinesProps {
  return lines
}

export function CrewLeadMini(props: CrewLeadMiniProps) {
  const { bayName, title, name, hp, maxHp, onHpChange, instance, mode, peekAt, entity } = props
  const own = props.model
  const base = useMemo(() => own ?? toEntityModel(entity as RefMetaEntity), [own, entity])
  const editing = onHpChange !== undefined
  // In Edit the crew lead starts collapsed, its lines read as in Read; its
  // Details control opens their fields: a bay's crew lead is a collapsed
  // Mini, not four open fields.
  const [open, setOpen] = useState(false)
  const { model, hpHint } = useMemo(() => crewHead(base), [base])
  const relations = roleChip(title, name)
  // Its HP right of its lines, as Mini HP cells (R46): set in Edit, read in
  // Read.
  const hpGauge =
    maxHp > 0 ? (
      <div className="su-crew-lead__hp" title={hpHint}>
        <VitalGauge
          label="HP"
          size="mini"
          value={hp}
          max={maxHp}
          {...(editing ? { onChange: onHpChange } : { readOnly: true })}
        />
      </div>
    ) : undefined
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labeled group (not a landmark) names the crew lead so the several on one crawler stay distinguishable; a <section> here would become a region landmark once named
    <div role="group" aria-label={`${bayName} crew lead`}>
      <Entity
        size="mini"
        context="roster"
        model={model}
        instance={instance}
        mode={mode}
        peekAt={peekAt}
        {...(relations ? { relations } : {})}
        {...(editing
          ? {
              controls: (
                <Toggle
                  variant="pencil"
                  size="mini"
                  pressed={open}
                  onClick={() => setOpen(!open)}
                  aria-label={`${open ? 'Close' : 'Edit'} ${bayName} crew details`}
                >
                  Details
                </Toggle>
              ),
            }
          : {})}
        body={{
          text: false,
          children: (
            <div className="su-crew-lead__body">
              {editing && !open ? (
                <NpcLines {...readLines(props)} />
              ) : (
                <NpcLines {...props} identity />
              )}
              {hpGauge}
            </div>
          ),
        }}
      />
    </div>
  )
}
