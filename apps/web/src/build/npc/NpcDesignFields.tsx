/**
 * The NPC designer's fields (`docs/architecture/npc-builder.md` §4.1), shared
 * by its steps, its one-page design from a template (r6 B3) and the NPC
 * sheet's Edit (r6 B12): the stats, the reference actions and traits it
 * carries, and who they are.
 */

import { Grid } from '../../components/app'
import { EmptyState, Field, Input, Select, Textarea } from '../../components/index'
import type { NpcFormState } from '../../lib/wizard/npcFormState'
import {
  addNpcAction,
  addNpcTrait,
  toggleNpcAction,
  toggleNpcTrait,
} from '../../lib/wizard/npcFormState'
import { npcCopy } from '../../messages/build-npc'
import { ActionPick, TraitPick } from './NpcPickRows'
import { ReferenceAdder } from './NpcReferenceAdder'
import { LIST, NPC_NAME_ID, PENCIL } from './npcStyles.model'

/** The stats: HP, HP-or-SP, bio-salvage value. */
export function NpcStatsFields({
  form,
  onChange,
  onLeave,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
  /** A typed number is left: the sheet saves it then, not per key (r6 B12). */
  onLeave?: () => void
}) {
  return (
    <Grid min="9rem" gap={12}>
      <Field label={npcCopy('hitPoints')} htmlFor="npc-hp" required>
        <Input
          id="npc-hp"
          inputMode="numeric"
          value={form.hitPoints}
          onChange={(e) => onChange({ hitPoints: e.target.value.replace(/[^0-9]/g, '') })}
          onBlur={onLeave}
          style={PENCIL}
        />
      </Field>
      <Field label={npcCopy('damageType')} htmlFor="npc-damage-type">
        <Select
          id="npc-damage-type"
          value={form.damageType}
          onChange={(e) => onChange({ damageType: e.target.value === 'SP' ? 'SP' : 'HP' })}
          style={PENCIL}
        >
          <option value="HP">{npcCopy('hp')}</option>
          <option value="SP">{npcCopy('sp')}</option>
        </Select>
      </Field>
      <Field label={npcCopy('bioSalvageValue')} htmlFor="npc-bio">
        <Input
          id="npc-bio"
          inputMode="numeric"
          placeholder="–"
          value={form.bioSalvageValue}
          onChange={(e) => onChange({ bioSalvageValue: e.target.value.replace(/[^0-9]/g, '') })}
          onBlur={onLeave}
          style={PENCIL}
        />
      </Field>
    </Grid>
  )
}

/** The reference actions and traits this NPC carries (D6). */
export function NpcActionsFields({
  form,
  onChange,
}: {
  form: NpcFormState
  onChange: (update: (prev: NpcFormState) => NpcFormState) => void
}) {
  return (
    <>
      {form.offeredActions.length === 0 && form.offeredTraits.length === 0 ? (
        <EmptyState variant="quiet" body={npcCopy('noActionsYetAnNpc')} />
      ) : (
        <ul style={LIST} aria-label={npcCopy('actionsAndTraits')}>
          {form.offeredActions.map((slug) => (
            <ActionPick
              key={slug}
              slug={slug}
              carried={form.actions.includes(slug)}
              onToggle={(carried) => onChange((prev) => toggleNpcAction(prev, slug, carried))}
            />
          ))}
          {form.offeredTraits.map((trait) => (
            <TraitPick
              key={trait.type}
              type={trait.type}
              amount={trait.amount}
              carried={form.traits.some((t) => t.type === trait.type)}
              onToggle={(carried) => onChange((prev) => toggleNpcTrait(prev, trait.type, carried))}
            />
          ))}
        </ul>
      )}
      <ReferenceAdder
        carriedActions={form.offeredActions}
        carriedTraits={form.offeredTraits.map((t) => t.type)}
        onAction={(slug) => onChange((prev) => addNpcAction(prev, slug))}
        onTrait={(type) => onChange((prev) => addNpcTrait(prev, type))}
      />
    </>
  )
}

/** The one field an NPC must have: its name. */
export function NpcNameField({
  form,
  onChange,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
}) {
  return (
    <Field label={npcCopy('name')} htmlFor={NPC_NAME_ID} required>
      <Input
        id={NPC_NAME_ID}
        value={form.name}
        onChange={(e) => onChange({ name: e.target.value })}
        style={PENCIL}
      />
    </Field>
  )
}

/** Who they are: the name (unless the page asks it first), then the rest, all optional. */
export function NpcIdentityFields({
  form,
  onChange,
  withName = true,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
  withName?: boolean
}) {
  return (
    <>
      {withName && <NpcNameField form={form} onChange={onChange} />}
      <Field label={npcCopy('position')} htmlFor="npc-position">
        <Input
          id="npc-position"
          placeholder={npcCopy('theirRoleUnionQuartermasterRaider')}
          value={form.position}
          onChange={(e) => onChange({ position: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label={npcCopy('description')} htmlFor="npc-description">
        <Textarea
          id="npc-description"
          rows={3}
          placeholder={npcCopy('whatTheyLookLikeAnd')}
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label={npcCopy('keepsake')} htmlFor="npc-keepsake">
        <Input
          id="npc-keepsake"
          value={form.keepsake}
          onChange={(e) => onChange({ keepsake: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label={npcCopy('motto')} htmlFor="npc-motto">
        <Input
          id="npc-motto"
          value={form.motto}
          onChange={(e) => onChange({ motto: e.target.value })}
          style={PENCIL}
        />
      </Field>
    </>
  )
}
