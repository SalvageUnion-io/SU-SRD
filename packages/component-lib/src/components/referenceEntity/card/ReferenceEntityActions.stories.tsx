import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaAction,
  SURefMetaEntity,
} from 'salvageunion-reference'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { ReferenceEntityCard } from './ReferenceEntityCard'
import { resolveCardTone } from './entityCardTone'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Reference Entity Actions',
}

/**
 * This story is the SPEC for how actions render. Actions are NOT a separate
 * component — an action is `ReferenceEntityCard` rendering an `actions`-schema
 * entity in "action mode". These are the enshrined rendering rules:
 *
 * - GHOSTED PARENT TONE on the header + sub-header bands + 3px frame (an action
 *   is a faded relative of the entity that summons it — same colour family).
 * - PAPER body with ink text (readable, like an entity body).
 * - EP-LED sub-header: EP cost · Action Type · Range · Damage · Traits.
 * - The ACTION TYPE lives in the sub-header (a leading cell) — there is NO seam
 *   type-stamp on an action.
 * - Always COMPACT.
 */

/** Real SRD lookup with a first-entry fallback (data-drift safety). */
function pick<T>(list: T[], predicate: (item: T) => boolean, label: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`NEW/Actions story: no ${label} loaded`)
  return found
}

/**
 * Resolve a parent entity's tone base EXACTLY as the card does internally — the
 * value threaded to the action as `hostTone`, which the action then ghosts.
 */
function parentToneBase(parent: SURefEntity): string {
  const schemaName = (parent as { schemaName?: string }).schemaName as
    | SURefEnumSchemaName
    | 'actions'
  const tone = resolveCardTone(schemaName, parent as SURefMetaEntity)
  return borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)'
}

/** Pick a named action off a parent via the same resolver the card uses. */
function actionOf(parent: SURefEntity, actionName: string): SURefMetaAction {
  const actions = extractVisibleActions(parent as SURefMetaEntity) ?? []
  return pick(actions, (a) => a.name === actionName, `${actionName} action`)
}

// Canonical real actions from a FEW DIFFERENT PARENTS — each ghosts its parent's
// tone. Resolved the same way the card resolves them internally.
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

type ActionSpec = {
  /** Parent entity that summons the action. */
  parent: SURefEntity
  /** Human label for the parent + the tone the action inherits. */
  parentLabel: string
  /** The action to render. */
  action: SURefMetaAction
}

const SPECS: ActionSpec[] = [
  {
    parent: drill,
    parentLabel: 'System · Salvaging Drill -> GHOSTED TECH-BLUE',
    action: actionOf(drill, 'Auger'),
  },
  {
    parent: scylla,
    parentLabel: 'Bio-Titan · Scylla -> GHOSTED NAVY',
    action: actionOf(scylla, 'Scythe Attack'),
  },
  {
    parent: engineering,
    parentLabel: 'Ability · Engineering Expertise -> GHOSTED ORANGE',
    action: actionOf(engineering, 'Engineering Expertise'),
  },
]

/** The rules each card demonstrates — captioned so the story documents the spec. */
const RULES = [
  'ghosted-parent-tone bands + 3px frame',
  'paper / ink body',
  'EP-led sub-header (EP · Type · Range · Damage · Traits)',
  'action type in the sub-header — no seam type-stamp',
  'always compact',
]

function HeaderNote(): ReactNode {
  return (
    <div className="flex flex-col gap-1 border-b-2 border-ink pb-3">
      <code className="font-body text-caption font-bold text-ink">
        Actions = the card in action mode; these are the rendering rules.
      </code>
      <ul className="flex flex-col gap-0.5">
        {RULES.map((rule) => (
          <li key={rule} className="font-body text-nano text-ink-2">
            · {rule}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One action card + a caption naming the parent tone it ghosts. */
function ActionSpecCard({ spec }: { spec: ActionSpec }): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <code className="font-body text-nano text-ink-2">{spec.parentLabel}</code>
      <ReferenceEntityCard
        data={spec.action as unknown as SURefEntity}
        hostTone={parentToneBase(spec.parent)}
        size="compact"
      />
    </div>
  )
}

export const Auger_GhostedTechBlue: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-4">
    <HeaderNote />
    {SPECS[0] && <ActionSpecCard spec={SPECS[0]} />}
  </div>
)

export const ScytheAttack_GhostedNavy: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-4">
    <HeaderNote />
    {SPECS[1] && <ActionSpecCard spec={SPECS[1]} />}
  </div>
)

export const EngineeringExpertise_GhostedOrange: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-4">
    <HeaderNote />
    {SPECS[2] && <ActionSpecCard spec={SPECS[2]} />}
  </div>
)

/** All three parents together — the full action-rendering spec at a glance. */
export const Spec: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-4">
    <HeaderNote />
    {SPECS.map((spec) => (
      <ActionSpecCard key={spec.parentLabel} spec={spec} />
    ))}
  </div>
)

/**
 * Action BADGE mode — the shortform token for an action, collapsed to a single
 * pill. Field order: **name · Cost · type · Damage · range** — the name always
 * leads (left-aligned so a stack of badges reads down a name column), the rest
 * render only when the action carries them (Scythe Attack has damage + range but
 * no cost; Engineering Expertise, a passive, has neither). Same ghosted-parent
 * tone as the full action card.
 */
export const Badge: Story = () => (
  <div className="flex flex-col items-start gap-3 bg-paper p-4">
    <code className="font-body text-caption font-bold text-ink">
      Action badge = name · Cost · type · Damage · range (name always leads)
    </code>
    {SPECS.map((spec) => (
      <div key={spec.parentLabel} className="flex flex-col items-start gap-1.5">
        <code className="font-body text-nano text-ink-2">{spec.parentLabel}</code>
        <ReferenceEntityCard
          data={spec.action as unknown as SURefEntity}
          hostTone={parentToneBase(spec.parent)}
          size="badge"
        />
      </div>
    ))}
  </div>
)
