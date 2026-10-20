/**
 * AnyNpcDesigner — board N1: design an NPC from a reference template in the five
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

import { NpcSchema } from 'game-domain/schemas/npc'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { RefNPC } from 'salvageunion-reference'
import { displayTitle, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Entity,
  Field,
  FieldError,
  Input,
  ModalShell,
  RadioCardGroup,
  SearchField,
  Select,
  Textarea,
  TitledBox,
  tokens,
} from '../../components/index'
import { WritesBlockedNotice } from '../../components/shared/WritesBlockedNotice'
import { useConnection } from '../../lib/connection/connectionContext'
import { npcActionSlug } from '../../lib/npcs/npcModel'
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
import { readWizardDraft, useWizardDraftSync, wizardDraftKey } from '../../lib/wizard/wizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizShell } from '../wizard/WizShell'
import { NpcCard } from './NpcCard'
import { ActionPick, TraitPick } from './NpcPickRows'
import { CAPS, CAPS_LABEL, COLUMN, HINT, LIST, NOTE, PENCIL, ROW } from './npcStyles.model'

const STEP_INTRO: Record<NpcStepId, string> = {
  template:
    'Start from an NPC in the reference: it fills the stats, actions and traits, and you change what you like. Or start blank.',
  stats: 'Hit points, whether they are HP or SP, and what the NPC is worth as bio-salvage.',
  actions:
    'Actions and traits come from the reference, so the rules text is always the book’s. You choose which ones this NPC carries.',
  identity: 'Who they are. Only the name is required.',
  review: 'Check the card, then save the NPC to your Training Bay.',
}

/** The step beside its live preview, where there is room for both; stacked where not. */
const STEP_COLUMNS = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[32],
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))',
} satisfies CSSProperties

const STAT_GRID = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
} satisfies CSSProperties

/** A match: the outlined `Button` (R16), the row's width, its kind at the far end. */
const RESULT_BUTTON = { justifyContent: 'space-between', width: '100%' } satisfies CSSProperties

type AnyNpcDesignerProps = {
  /** The maker's display name, for the preview's "Made by". */
  madeBy: string
  /** Called with the new NPC's id once it is saved. */
  onCreated: (npcId: string) => void
  onCancel: () => void
}

export function AnyNpcDesigner({ madeBy, onCreated, onCancel }: AnyNpcDesignerProps) {
  const { canWrite } = useConnection()
  const draftKey = wizardDraftKey('npc')
  const [form, setForm] = useState<NpcFormState>(
    () => readWizardDraft<NpcFormState>(draftKey) ?? EMPTY_NPC_FORM
  )
  const formDirty = useWizardDraftSync(draftKey, form, EMPTY_NPC_FORM)
  /** A restart waiting on the player's yes: a template, or `'blank'` (D4). */
  const [pendingStart, setPendingStart] = useState<RefNPC | 'blank' | null>(null)
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
    failureMessage: 'The NPC could not be saved. Try again.',
    onComplete: onCreated,
    onCancel,
  })
  const { step, gate, submitError, shell } = flow

  const template = useMemo(
    () =>
      form.templateRef?.schema === 'npcs'
        ? readReference(
            'AnyNpcDesigner.template',
            () => SalvageUnionReference.NPCs.getBySlug(form.templateRef?.slug ?? '') ?? undefined,
            undefined
          )
        : undefined,
    [form.templateRef]
  )

  function update(patch: Partial<NpcFormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  /** Choose a template: fill at once, or ask first when the stats were edited (D4). */
  function chooseTemplate(ref: RefNPC) {
    if (form.templateChosen && statsEditedSinceFill(form)) {
      setPendingStart(ref)
      return
    }
    setForm((prev) => applyNpcTemplate(prev, ref))
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
        eyebrow="Denizens · New NPC"
        band={false}
        {...shell}
        nextDisabled={shell.nextDisabled || writesBlocked}
        title={NPC_STEP_LABELS[step]}
        footerNote={!gate.ok ? gate.reason : undefined}
        submitLabel="Save NPC"
      >
        <div style={STEP_COLUMNS}>
          <section style={COLUMN} aria-label={NPC_STEP_LABELS[step]}>
            {step !== 'template' && form.templateChosen && (
              <div style={ROW}>
                <span className={CAPS_LABEL} style={CAPS}>
                  Template
                </span>
                {/* Change is the template Mini's last chip (C8, hard rule R6). */}
                {template ? (
                  <Entity
                    size="mini"
                    context="browse"
                    entity={template}
                    controls={
                      <Button
                        size="mini"
                        aria-label="Change the template"
                        onClick={() => shell.onStepClick(0)}
                      >
                        Change
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <span style={HINT}>Started blank</span>
                    <Button variant="ghost" size="compact" onClick={() => shell.onStepClick(0)}>
                      Change
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
                Preview
              </Button>
            )}

            {step === 'template' && (
              <TemplateStep form={form} onTemplate={chooseTemplate} onBlank={chooseBlank} />
            )}
            {step === 'stats' && <StatsStep form={form} onChange={update} />}
            {step === 'actions' && <ActionsStep form={form} onChange={setForm} />}
            {step === 'identity' && <IdentityStep form={form} onChange={update} />}
            {step === 'review' && <div>{preview}</div>}

            {writesBlocked && <WritesBlockedNotice />}
            {submitError && <FieldError>{submitError}</FieldError>}
          </section>

          <section className="su-npc-preview" aria-label="Live preview">
            <p className={CAPS_LABEL} style={CAPS}>
              Live preview · how it will look in your Training Bay and in a Game
            </p>
            {preview}
            <p style={NOTE}>
              <strong>Yours, not the book&rsquo;s.</strong> A designed NPC keeps its
              template&rsquo;s link to the reference, but wears the user-made frame and your name.
              It can go in your Training Bay, into a Game, or into a crawler&rsquo;s crew.
            </p>
          </section>
        </div>
      </WizShell>

      <ModalShell
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Preview"
        subtitle="How it will look in your Training Bay and in a Game"
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
            ? 'Start blank?'
            : `Start again from ${pendingStart?.name ?? 'this template'}?`
        }
        body={
          pendingStart === 'blank'
            ? 'Your stats, actions and traits are cleared. The name and identity you wrote stay.'
            : 'Its stats, actions and traits replace the ones you changed. The name and identity you wrote stay.'
        }
        confirmLabel={pendingStart === 'blank' ? 'Clear' : 'Replace'}
        tone="danger"
        onConfirm={() => {
          const start = pendingStart
          if (start === 'blank') setForm((prev) => applyBlankStart(prev))
          else if (start) setForm((prev) => applyNpcTemplate(prev, start))
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
  onTemplate: (ref: RefNPC) => void
  onBlank: () => void
}) {
  const [query, setQuery] = useState('')
  const all = useMemo(
    () => readReference('TemplateStep.npcs', () => SalvageUnionReference.NPCs.all(), []),
    []
  )
  const shown = all.filter((n) => n.name.toLowerCase().includes(query.trim().toLowerCase()))
  const blankChosen = form.templateChosen && form.templateRef === null

  return (
    <>
      <SearchField
        aria-label="Find a template"
        placeholder="Find an NPC in the reference"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* One template or none: a radio (hard rule R15), each pick ringed and sealed. */}
      <RadioCardGroup label="Template">
        <ul style={LIST} aria-label="Templates">
          <li>
            {/* No entity, so no Compact: the Compact's frame in select mode. */}
            <TitledBox
              title="Start blank"
              select={{
                kind: 'select',
                role: 'radio',
                selected: blankChosen,
                onSelect: onBlank,
                label: 'Start blank',
              }}
            >
              <span style={HINT}>No template. Set the stats and pick the actions yourself.</span>
            </TitledBox>
          </li>
          {shown.map((npc) => (
            <li key={npc.id}>
              {/* A picker (E1): a Compact in select mode; the list names the kind. */}
              <Entity
                size="compact"
                entity={npc}
                omit={OMIT_KIND}
                mode={{
                  kind: 'select',
                  role: 'radio',
                  selected:
                    form.templateRef?.schema === 'npcs' &&
                    form.templateRef.slug === nameToSlug(npc.name),
                  onSelect: () => onTemplate(npc),
                  label: `Start from ${npc.name}`,
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
    <div style={STAT_GRID}>
      <Field label="Hit points" htmlFor="npc-hp" required>
        <Input
          id="npc-hp"
          inputMode="numeric"
          value={form.hitPoints}
          onChange={(e) => onChange({ hitPoints: e.target.value.replace(/[^0-9]/g, '') })}
          style={PENCIL}
        />
      </Field>
      <Field label="Damage type" htmlFor="npc-damage-type">
        <Select
          id="npc-damage-type"
          value={form.damageType}
          onChange={(e) => onChange({ damageType: e.target.value === 'SP' ? 'SP' : 'HP' })}
          style={PENCIL}
        >
          <option value="HP">HP</option>
          <option value="SP">SP</option>
        </Select>
      </Field>
      <Field label="Bio salvage value" htmlFor="npc-bio">
        <Input
          id="npc-bio"
          inputMode="numeric"
          placeholder="–"
          value={form.bioSalvageValue}
          onChange={(e) => onChange({ bioSalvageValue: e.target.value.replace(/[^0-9]/g, '') })}
          style={PENCIL}
        />
      </Field>
    </div>
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
        <EmptyState
          variant="quiet"
          body="No actions yet. An NPC may carry none; add any from the reference below."
        />
      ) : (
        <ul style={LIST} aria-label="Actions and traits">
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

/** A list of one kind: its Compacts drop the kind stamp. */
const OMIT_KIND = ['kind'] as const

/** The search that adds an action or a trait from the reference (D6). */
function ReferenceAdder({
  carriedActions,
  carriedTraits,
  onAction,
  onTrait,
}: {
  carriedActions: readonly string[]
  carriedTraits: readonly string[]
  onAction: (slug: string) => void
  onTrait: (type: string) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (q.length < 2) return []
    const actions = readReference(
      'ReferenceAdder.actions',
      () => SalvageUnionReference.Actions.all(),
      []
    )
      .filter((a) => a.name.toLowerCase().includes(q))
      .map((a) => ({ kind: 'Action' as const, name: a.name }))
    const traits = readReference(
      'ReferenceAdder.traits',
      () => SalvageUnionReference.Traits.all(),
      []
    )
      .filter((t) => t.name.toLowerCase().includes(q))
      .map((t) => ({ kind: 'Trait' as const, name: t.name }))
    return [...traits, ...actions].slice(0, 8)
  }, [q])

  return (
    <div style={COLUMN}>
      <SearchField
        aria-label="Add an action or trait from the reference"
        placeholder="Add an action or trait from the reference"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <ul style={LIST} aria-label="Matches">
          {matches.map((m) => {
            const slug = m.kind === 'Action' ? npcActionSlug(m.name) : m.name
            const has =
              m.kind === 'Action' ? carriedActions.includes(slug) : carriedTraits.includes(m.name)
            return (
              <li key={`${m.kind}:${m.name}`}>
                <Button
                  variant="default"
                  style={RESULT_BUTTON}
                  disabled={has}
                  onClick={() => {
                    if (m.kind === 'Action') onAction(slug)
                    else onTrait(m.name)
                    setQuery('')
                  }}
                >
                  <span>
                    {has
                      ? `${displayTitle(m.name)} — already listed`
                      : `Add ${displayTitle(m.name)}`}
                  </span>
                  <span>{m.kind}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
      <Field label="Name" htmlFor="npc-name" required>
        <Input
          id="npc-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label="Position" htmlFor="npc-position">
        <Input
          id="npc-position"
          placeholder="Their role: Union Quartermaster, Raider…"
          value={form.position}
          onChange={(e) => onChange({ position: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label="Description" htmlFor="npc-description">
        <Textarea
          id="npc-description"
          rows={3}
          placeholder="What they look like, and how they carry themselves."
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label="Keepsake" htmlFor="npc-keepsake">
        <Input
          id="npc-keepsake"
          value={form.keepsake}
          onChange={(e) => onChange({ keepsake: e.target.value })}
          style={PENCIL}
        />
      </Field>
      <Field label="Motto" htmlFor="npc-motto">
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
