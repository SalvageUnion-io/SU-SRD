/**
 * AnyNpcDesigner — design an NPC from a reference template in the five
 * steps of `docs/architecture/npc-builder.md` §4.1 (Template, Stats, Actions &
 * traits, Identity, Review), beside a live preview of its card.
 *
 * - The template is a reference NPC (`npcs.json`) or "Start blank" (D4). It
 *   fills Stats and Actions & traits and keeps Identity; changing it asks
 *   first only when those were edited since it last filled them.
 * - Actions and traits are the reference's, never text (D6): each a header-only
 *   card with a checkbox that opens its full rules; a search adds more.
 * - The only hard gates are a name and HP ≥ 1 (`npcCreationStepGate`).
 * - The preview is the card on a shelf or in a Game: dashed, HOMEBREW, "Made by
 *   [maker]" (D9). The template's description pre-fills Identity; edits win (D5).
 *
 * The step machine and create are `useWizardFlow`'s, drawn by `WizShell` like every
 * wizard (hard rule R16); drafts go through `wizardDraft.ts`.
 */

import type { NpcTemplateKind, NpcTemplateRef } from 'game-domain/schemas/npc'
import { NPC_TEMPLATE_KINDS, NpcSchema } from 'game-domain/schemas/npc'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { ConfirmDialog, FieldError, Grid } from '../../components/app'
import {
  Button,
  EmptyState,
  Entity,
  Field,
  Input,
  ModalShell,
  RadioCardGroup,
  SearchField,
  Segmented,
  SegmentedOption,
  Select,
  Textarea,
  TitledBox,
} from '../../components/index'
import type { DenizenTemplate } from '../../lib/npcs/npcModel'
import { denizenTemplate, isDenizenKind } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { npcCreationStepGate } from '../../lib/rules/creation'
import type { NpcFormState, NpcStepId } from '../../lib/wizard/npcFormState'
import {
  addNpcAction,
  addNpcTrait,
  applyBlankStart,
  applyNpcTemplate,
  EMPTY_NPC_FORM,
  NPC_STEP_LABELS,
  NPC_STEPS,
  npcFormToCreateInput,
  npcFormView,
  statsEditedSinceFill,
  toggleNpcAction,
  toggleNpcTrait,
} from '../../lib/wizard/npcFormState'
import { npcCopy } from '../../messages/build-npc'
import { useSync } from '../../replica/syncContext'
import { useWizardDraft } from '../wizard/useWizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizShell } from '../wizard/WizShell'
import { NpcCard } from './NpcCard'
import { ActionPick, TraitPick } from './NpcPickRows'
import { ReferenceAdder } from './NpcReferenceAdder'
import { CAPS, CAPS_LABEL, COLUMN, HINT, LIST, NOTE, PENCIL, ROW } from './npcStyles.model'

const STEP_INTRO: Record<NpcStepId, string> = {
  template:
    'Start from anything in the reference’s denizens (an NPC, a Squad, a Creature, a Vehicle, a Drone, a Meld, a Bio-Titan): it fills the stats, actions and traits, and you change what you like. Or start blank.',
  stats: 'Hit points, whether they are HP or SP, and what the NPC is worth as bio-salvage.',
  actions:
    'Actions and traits come from the reference, so the rules text is always the book’s. You choose which ones this NPC carries.',
  identity: 'Who they are. Only the name is required.',
  review: 'Check the card, then save the NPC to your Mediator’s Kit.',
}

/** The step beside its live preview, where there is room for both; stacked where not. */
const STEP_COLUMNS = { alignItems: 'start' } satisfies CSSProperties

type AnyNpcDesignerProps = {
  /** The maker's display name, for the preview's "Made by". */
  madeBy: string
  /** Called with the new NPC's id once it is saved. */
  onCreated: (npcId: string) => void
  onCancel: () => void
  /** A denizen to start from (`?from=`, a Reference page's "Design from this"). */
  startFrom?: NpcTemplateRef
}

/** What each kind of denizen is called on its tab. */
const TEMPLATE_KIND_LABEL: Record<NpcTemplateKind, string> = {
  npcs: 'NPCs',
  squads: 'Squads',
  creatures: 'Creatures',
  vehicles: 'Vehicles',
  drones: 'Drones',
  meld: 'Meld',
  'bio-titans': 'Bio-Titans',
}

/** A template waiting to be applied: the denizen and the kind it is. */
type Start = { schema: NpcTemplateKind; entity: DenizenTemplate }

export function AnyNpcDesigner({ madeBy, onCreated, onCancel, startFrom }: AnyNpcDesignerProps) {
  const { canWrite } = useSync()
  const { form, setForm, formDirty, draftKey } = useWizardDraft<NpcFormState>('npc', {
    baseline: EMPTY_NPC_FORM,
  })
  /** A restart waiting on the player's yes: a template, or `'blank'` (D4). */
  const [pendingStart, setPendingStart] = useState<Start | 'blank' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const flow = useWizardFlow({
    entityType: 'npc',
    noun: 'NPC',
    steps: NPC_STEPS,
    stepLabels: NPC_STEP_LABELS,
    gateFor: (s) => npcCreationStepGate(s, form),
    initialStep: 'template',
    submitStep: 'review',
    form,
    draftKey,
    formDirty,
    schema: NpcSchema,
    toCreateInput: npcFormToCreateInput,
    failureMessage: npcCopy('theNpcCouldNotBe'),
    onComplete: onCreated,
    onCancel,
  })
  const { step, gate, submitError, shell } = flow

  const template = useMemo(
    () => (denizenTemplate(form.templateRef) as RefEntity | null) ?? undefined,
    [form.templateRef]
  )

  // Arriving from a Reference page: start from that denizen, once, and only
  // where no start was chosen (a kept draft is the player's).
  const arrived = useRef(false)
  useEffect(() => {
    if (arrived.current || startFrom === undefined) return
    arrived.current = true
    const entity = denizenTemplate(startFrom)
    if (entity === null || !isDenizenKind(startFrom.schema)) return
    const schema = startFrom.schema
    setForm((prev) => (prev.templateChosen ? prev : applyNpcTemplate(prev, entity, schema)))
  }, [startFrom, setForm])

  function update(patch: Partial<NpcFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /** Choose a template: fill at once, or ask first when the stats were edited (D4). */
  function chooseTemplate(start: Start) {
    if (form.templateChosen && statsEditedSinceFill(form)) {
      setPendingStart(start)
      return
    }
    setForm((prev) => applyNpcTemplate(prev, start.entity, start.schema))
  }

  /** Start blank: the same question as a template, since it clears the same fields (D4). */
  function chooseBlank() {
    if (form.templateChosen && statsEditedSinceFill(form)) {
      setPendingStart('blank')
      return
    }
    setForm((prev) => applyBlankStart(prev))
  }

  const preview = <NpcCard npc={npcFormView(form)} madeBy={madeBy} />
  const writesBlocked = step === 'review' && !canWrite

  return (
    <>
      {/* The one wizard (hard rule R16): WizShell's rail, step head and action
          pill, under the designer page's own band (its Any NPC | Crawler crew
          tabs). The step sits beside its live preview. */}
      <WizShell
        kind="npc"
        eyebrow={npcCopy('denizensNewNpc')}
        band={false}
        {...shell}
        nextDisabled={shell.nextDisabled || writesBlocked}
        title={NPC_STEP_LABELS[step]}
        footerNote={!gate.ok ? gate.reason : undefined}
        submitLabel={npcCopy('saveNpc')}
      >
        <Grid min="24rem" gap={32} style={STEP_COLUMNS}>
          <section style={COLUMN} aria-label={NPC_STEP_LABELS[step]}>
            {step !== 'template' && form.templateChosen && (
              <div style={ROW}>
                <span className={CAPS_LABEL} style={CAPS}>
                  {npcCopy('template')}
                </span>
                {/* Change is the template Mini's last chip (C8). */}
                {template ? (
                  <Entity
                    size="mini"
                    context="browse"
                    entity={template}
                    controls={
                      <Button
                        size="mini"
                        aria-label={npcCopy('changeTheTemplate')}
                        onClick={() => shell.onStepClick(0)}
                      >
                        {npcCopy('change')}
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <span style={HINT}>{npcCopy('startedBlank')}</span>
                    <Button variant="ghost" size="compact" onClick={() => shell.onStepClick(0)}>
                      {npcCopy('change')}
                    </Button>
                  </>
                )}
              </div>
            )}
            <p style={HINT}>{STEP_INTRO[step]}</p>
            {step !== 'review' && (
              <Button
                variant="ghost"
                size="compact"
                className="su-npc-preview-toggle"
                onClick={() => setPreviewOpen(true)}
              >
                {npcCopy('preview')}
              </Button>
            )}

            {step === 'template' && (
              <TemplateStep form={form} onTemplate={chooseTemplate} onBlank={chooseBlank} />
            )}
            {step === 'stats' && <StatsStep form={form} onChange={update} />}
            {step === 'actions' && <ActionsStep form={form} onChange={setForm} />}
            {step === 'identity' && <IdentityStep form={form} onChange={update} />}
            {step === 'review' && <div>{preview}</div>}

            {submitError && <FieldError>{submitError}</FieldError>}
          </section>

          <section className="su-npc-preview" aria-label={npcCopy('livePreview')}>
            <p className={CAPS_LABEL} style={CAPS}>
              {npcCopy('livePreviewHowItWill')}
            </p>
            {preview}
            <p style={NOTE}>
              <strong>{npcCopy('yoursNotTheBooks')}</strong> A designed NPC keeps its
              template&rsquo;s link to the reference, but wears the user-made frame and your name.
              It is kept in your Mediator&rsquo;s Kit, and can go into a Game or a crawler&rsquo;s
              crew.
            </p>
          </section>
        </Grid>
      </WizShell>

      <ModalShell
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={npcCopy('preview')}
        subtitle={npcCopy('howItWillLookIn')}
      >
        {preview}
      </ModalShell>

      <ConfirmDialog
        open={pendingStart !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStart(null)
        }}
        title={
          pendingStart === 'blank'
            ? npcCopy('startBlank')
            : `Start again from ${pendingStart?.entity.name ?? 'this template'}?`
        }
        body={
          pendingStart === 'blank'
            ? npcCopy('yourStatsActionsAndTraits')
            : npcCopy('itsStatsActionsAndTraits')
        }
        confirmLabel={pendingStart === 'blank' ? npcCopy('clear') : npcCopy('replace')}
        tone="danger"
        onConfirm={() => {
          const start = pendingStart
          if (start === 'blank') setForm((prev) => applyBlankStart(prev))
          else if (start) setForm((prev) => applyNpcTemplate(prev, start.entity, start.schema))
          setPendingStart(null)
        }}
      />
    </>
  )
}

/** Step 1: a reference NPC, filtered by name, or a blank start (D4). */
function TemplateStep({
  form,
  onTemplate,
  onBlank,
}: {
  form: NpcFormState
  onTemplate: (start: Start) => void
  onBlank: () => void
}) {
  const [query, setQuery] = useState('')
  // Every denizen the Opposition fields, book NPCs first (ADR-067 §2).
  const all = useMemo(
    () =>
      readReference(
        'TemplateStep.denizens',
        () => SalvageUnionReference.getAllBySchemaNames([...NPC_TEMPLATE_KINDS]),
        []
      ),
    []
  )
  // One kind at a time, book NPCs first; a search reads every kind at once.
  const [kind, setKind] = useState<NpcTemplateKind>('npcs')
  const typed = query.trim().toLowerCase()
  const shown = all.filter(({ schemaName, entity }) =>
    typed === '' ? schemaName === kind : entity.name.toLowerCase().includes(typed)
  )
  const blankChosen = form.templateChosen && form.templateRef === null

  return (
    <>
      <SearchField
        aria-label={npcCopy('findATemplate')}
        placeholder={npcCopy('findAnNpcInThe')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Segmented label={npcCopy('templateKind')} size="compact" wrap>
        {NPC_TEMPLATE_KINDS.map((k) => (
          <SegmentedOption
            key={k}
            pressed={typed === '' && k === kind}
            onClick={() => {
              setKind(k)
              setQuery('')
            }}
          >
            {TEMPLATE_KIND_LABEL[k]}
          </SegmentedOption>
        ))}
      </Segmented>
      {/* One template or none: a radio (hard rule R15), each pick ringed and sealed. */}
      <RadioCardGroup label={npcCopy('template')}>
        <ul style={LIST} aria-label={npcCopy('templates')}>
          <li>
            {/* No entity, so no Compact: the Compact's frame in select mode. */}
            <TitledBox
              title={npcCopy('startBlank2')}
              select={{
                kind: 'select',
                role: 'radio',
                selected: blankChosen,
                onSelect: onBlank,
                label: npcCopy('startBlank2'),
              }}
            >
              <span style={HINT}>{npcCopy('noTemplateSetTheStats')}</span>
            </TitledBox>
          </li>
          {shown.map(({ schemaName, entity }) => (
            <li key={`${schemaName}:${entity.id}`}>
              {/* A picker (E1): a Compact in select mode, its kind on it. */}
              <Entity
                size="compact"
                entity={entity}
                mode={{
                  kind: 'select',
                  role: 'radio',
                  selected:
                    form.templateRef?.schema === schemaName &&
                    form.templateRef.slug === nameToSlug(entity.name),
                  onSelect: () => onTemplate({ schema: schemaName, entity }),
                  label: npcCopy('startFrom', { name: entity.name }),
                }}
              />
            </li>
          ))}
        </ul>
      </RadioCardGroup>
    </>
  )
}

/** Step 2: HP, HP-or-SP, bio-salvage value. */
function StatsStep({
  form,
  onChange,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
}) {
  return (
    <Grid min="9rem" gap={12}>
      <Field label={npcCopy('hitPoints')} htmlFor="npc-hp" required>
        <Input
          id="npc-hp"
          inputMode="numeric"
          value={form.hitPoints}
          onChange={(e) => onChange({ hitPoints: e.target.value.replace(/[^0-9]/g, '') })}
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
          style={PENCIL}
        />
      </Field>
    </Grid>
  )
}

/** Step 3: the reference actions and traits this NPC carries (D6). */
function ActionsStep({
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

/** Step 4: who they are. */
function IdentityStep({
  form,
  onChange,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
}) {
  return (
    <>
      <Field label={npcCopy('name')} htmlFor="npc-name" required>
        <Input
          id="npc-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={PENCIL}
        />
      </Field>
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
