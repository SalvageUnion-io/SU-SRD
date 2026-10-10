/**
 * AnyNpcDesigner — board N1: design an NPC from a reference template, in the
 * five steps of `docs/architecture/npc-builder.md` §4.1 (Template, Stats,
 * Actions & traits, Identity, Review), beside a live preview of the finished
 * card.
 *
 * - The template is a reference NPC (`npcs.json`) or "Start blank" (D4). It
 *   fills Stats and Actions & traits and keeps Identity; changing it asks
 *   first only when those were edited since it last filled them.
 * - Actions and traits are the reference's, never text (D6): each is a
 *   header-only card with a checkbox, opening its full rules in the detail
 *   modal, and a search adds more.
 * - The only hard gates are a name and HP ≥ 1 (`npcCreationStepGate`).
 * - The preview is the card as it will look on a shelf and in a Game: dashed,
 *   User-made, "Made by [you]" (D9). It renders only what the player wrote: a
 *   template's prose shows as a placeholder, never as their description (D5).
 *
 * The step machine and the create are `useWizardFlow`'s, as for the other
 * three wizards; the draft persists through `wizardDraft.ts`.
 */

import {
  Button,
  ConfirmDialog,
  Field,
  FieldError,
  Input,
  ModalShell,
  ReferenceEntityCard,
  SearchField,
  Select,
  Slab,
  Textarea,
  tokens,
  useDetailModal,
} from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { SURefEntity, SURefNPC } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { useConnection } from '../../lib/connection/connectionContext'
import { npcActionName, npcActionSlug, resolveNpcAction } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { npcCreationStepGate } from '../../lib/rules/creation'
import { NpcSchema } from '../../lib/schemas/npc'
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
import { WritesBlockedNotice } from '../shared/WritesBlockedNotice'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { NpcCard } from './NpcCard'
import { CAPS, COLUMN, COLUMNS, HINT, LIST, NOTE, PENCIL, ROW } from './npcStyles'

const STEP_INTRO: Record<NpcStepId, string> = {
  template:
    'Start from an NPC in the reference: it fills the stats, actions and traits, and you change what you like. Or start blank.',
  stats: 'Hit points, whether they are HP or SP, and what the NPC is worth as bio-salvage.',
  actions:
    'Actions and traits come from the reference, so the rules text is always the book’s. You choose which ones this NPC carries.',
  identity: 'Who they are. Only the name is required.',
  review: 'Check the card, then save the NPC to your shelf.',
}

/** Where a reference template's own words are read, for a placeholder only (D5). */
function templateProse(ref: SURefNPC | undefined): string {
  const first = ref?.content?.find((b) => b.type === 'paragraph')
  return typeof first?.value === 'string' ? first.value : ''
}

const CHECK_HIT = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'flex',
  flexShrink: 0,
  justifyContent: 'center',
  minHeight: '2.75rem',
  minWidth: '2.75rem',
} satisfies CSSProperties

const CHECK = {
  accentColor: tokens.color.ink,
  cursor: 'pointer',
  height: '1.375rem',
  margin: 0,
  width: '1.375rem',
} satisfies CSSProperties

const PICK_ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[8],
} satisfies CSSProperties

const GROW = { flex: 1, minWidth: 0 } satisfies CSSProperties

const STAT_GRID = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
} satisfies CSSProperties

const BLANK_TILE = {
  alignItems: 'flex-start',
  background: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.ink,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  minHeight: '2.75rem',
  padding: tokens.space[12],
  textAlign: 'left',
  width: '100%',
} satisfies CSSProperties

const RESULT_BUTTON = {
  alignItems: 'center',
  background: tokens.color.paper,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  color: tokens.color.ink,
  cursor: 'pointer',
  display: 'flex',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  gap: tokens.space[8],
  justifyContent: 'space-between',
  minHeight: '2.75rem',
  padding: `0 ${tokens.space[12]}`,
  textAlign: 'left',
  width: '100%',
} satisfies CSSProperties

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
  const [pendingTemplate, setPendingTemplate] = useState<SURefNPC | null>(null)
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
  const stepIndex = NPC_STEPS.indexOf(step)

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
  function chooseTemplate(ref: SURefNPC) {
    if (form.templateChosen && statsEditedSinceFill(form)) {
      setPendingTemplate(ref)
      return
    }
    setForm((prev) => applyNpcTemplate(prev, ref))
  }

  function chooseBlank() {
    setForm((prev) => applyBlankStart(prev))
  }

  const next = stepIndex < NPC_STEPS.length - 1 ? NPC_STEPS[stepIndex + 1] : undefined
  const nextLabel = next === undefined ? 'Save NPC' : `Next: ${NPC_STEP_LABELS[next]}`
  const preview = <NpcCard npc={npcFormView(form)} madeBy={madeBy} />

  return (
    <>
      <div style={{ ...COLUMNS, paddingTop: tokens.space[24] }}>
        <StepStrip
          step={step}
          onStepClick={shell.onStepClick}
          reachable={(i) =>
            i <= stepIndex || NPC_STEPS.slice(0, i).every((s) => npcCreationStepGate(s, form).ok)
          }
        />
      </div>
      <div style={COLUMNS}>
        <section style={COLUMN} aria-labelledby="npc-step-title">
          <Slab variant="solid" as="h2" id="npc-step-title" label={NPC_STEP_LABELS[step]} />
          {step !== 'template' && form.templateChosen && (
            <div style={ROW}>
              <span style={CAPS}>Template</span>
              {template ? (
                <ReferenceEntityCard data={template} size="small" extent="head" />
              ) : (
                <span style={HINT}>Started blank</span>
              )}
              <Button variant="ghost" size="compact" onClick={() => shell.onStepClick(0)}>
                Change
              </Button>
            </div>
          )}
          <p style={HINT}>{STEP_INTRO[step]}</p>

          {step === 'template' && (
            <TemplateStep form={form} onTemplate={chooseTemplate} onBlank={chooseBlank} />
          )}
          {step === 'stats' && <StatsStep form={form} onChange={update} />}
          {step === 'actions' && <ActionsStep form={form} onChange={setForm} />}
          {step === 'identity' && (
            <IdentityStep form={form} onChange={update} placeholder={templateProse(template)} />
          )}
          {step === 'review' && <div>{preview}</div>}

          {!gate.ok && gate.reason && <p style={HINT}>{gate.reason}</p>}
          {submitError && <FieldError>{submitError}</FieldError>}
          <div className="npc-nav" style={ROW}>
            <Button
              variant="default"
              onClick={shell.onBack ?? shell.onCancel}
              disabled={shell.busy}
            >
              {shell.onBack ? 'Back' : 'Cancel'}
            </Button>
            {step === 'review' && !canWrite ? (
              <WritesBlockedNotice />
            ) : (
              <Button
                variant="primary"
                onClick={shell.onNext}
                disabled={shell.nextDisabled || shell.busy}
              >
                {shell.busy ? 'Saving…' : nextLabel}
              </Button>
            )}
            {step !== 'review' && (
              <Button
                variant="ghost"
                className="npc-preview-toggle"
                onClick={() => setPreviewOpen(true)}
              >
                Preview
              </Button>
            )}
          </div>
        </section>

        <section className="npc-preview" aria-label="Live preview">
          <p style={CAPS}>Live preview · how it will look on your shelf and in a Game</p>
          {preview}
          <p style={NOTE}>
            <strong>Yours, not the book&rsquo;s.</strong> A designed NPC keeps its template&rsquo;s
            link to the reference, but wears the user-made frame and your name. It can go on your
            shelf, into a Game, or into a crawler&rsquo;s crew.
          </p>
        </section>
      </div>

      <ModalShell
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Preview"
        subtitle="How it will look on your shelf and in a Game"
      >
        {preview}
      </ModalShell>

      <ConfirmDialog
        open={pendingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null)
        }}
        title={`Start again from ${pendingTemplate?.name ?? 'this template'}?`}
        body="Its stats, actions and traits replace the ones you changed. The name and identity you wrote stay."
        confirmLabel="Replace"
        tone="danger"
        onConfirm={() => {
          const ref = pendingTemplate
          if (ref) setForm((prev) => applyNpcTemplate(prev, ref))
          setPendingTemplate(null)
        }}
      />
    </>
  )
}

/** The five steps across (from 48rem), or one compact line below that (§5). */
function StepStrip({
  step,
  onStepClick,
  reachable,
}: {
  step: NpcStepId
  onStepClick: (index: number) => void
  reachable: (index: number) => boolean
}) {
  const active = NPC_STEPS.indexOf(step)
  return (
    <nav aria-label="Design steps" style={{ gridColumn: '1 / -1' }}>
      <ol className="npc-steps">
        {NPC_STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              className="npc-step"
              aria-current={i === active ? 'step' : undefined}
              disabled={i !== active && !reachable(i)}
              onClick={() => onStepClick(i)}
            >
              <span aria-hidden="true">{i < active ? '✓' : i + 1}</span>
              {NPC_STEP_LABELS[s]}
            </button>
          </li>
        ))}
      </ol>
      <p className="npc-steps__compact" style={CAPS}>
        {active + 1} / {NPC_STEPS.length} · {NPC_STEP_LABELS[step]}
      </p>
    </nav>
  )
}

/** Step 1: a reference NPC, filtered by name, or a blank start (D4). */
function TemplateStep({
  form,
  onTemplate,
  onBlank,
}: {
  form: NpcFormState
  onTemplate: (ref: SURefNPC) => void
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
      <ul style={LIST} aria-label="Templates">
        <li>
          <button
            type="button"
            style={{
              ...BLANK_TILE,
              ...(blankChosen
                ? { borderStyle: 'solid', boxShadow: `0 0 0 2px ${tokens.color.ink}` }
                : {}),
            }}
            aria-pressed={blankChosen}
            onClick={onBlank}
          >
            <span style={CAPS}>Start blank</span>
            <span style={HINT}>No template. Set the stats and pick the actions yourself.</span>
          </button>
        </li>
        {shown.map((npc) => (
          <li key={npc.id}>
            <ReferenceEntityCard
              data={npc}
              size="small"
              extent="head"
              selected={
                form.templateRef?.schema === 'npcs' &&
                form.templateRef.slug === nameToSlug(npc.name)
              }
              onCardClick={() => onTemplate(npc)}
              cardClickLabel={`Start from ${npc.name}`}
              selectionRole="toggle"
            />
          </li>
        ))}
      </ul>
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
        <p style={HINT}>No actions yet. An NPC may carry none; add any from the reference below.</p>
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

/** One checkbox beside a header-only card; the card opens the full rules (D6). */
function PickRow({
  label,
  carried,
  onToggle,
  children,
}: {
  label: string
  carried: boolean
  onToggle: (carried: boolean) => void
  children: ReactNode
}) {
  return (
    <li style={PICK_ROW}>
      <label style={CHECK_HIT}>
        <input
          type="checkbox"
          style={CHECK}
          checked={carried}
          aria-label={label}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </label>
      <div style={GROW}>{children}</div>
    </li>
  )
}

function ActionPick({
  slug,
  carried,
  onToggle,
}: {
  slug: string
  carried: boolean
  onToggle: (carried: boolean) => void
}) {
  const action = resolveNpcAction(slug)
  // An action is a meta entity, which the detail modal's card renders as it
  // renders any other; the hook is typed to the plain union only.
  const detail = useDetailModal((action ?? undefined) as SURefEntity | undefined)
  const name = action?.name ?? npcActionName(slug)
  return (
    <PickRow label={`Carry ${name}`} carried={carried} onToggle={onToggle}>
      {action ? (
        <ReferenceEntityCard
          data={action}
          size="medium"
          extent="head"
          onCardClick={() => detail.control.onClick?.()}
          cardClickLabel={`Open ${name}`}
        />
      ) : (
        <span style={HINT}>{name}</span>
      )}
      {detail.modal}
    </PickRow>
  )
}

function TraitPick({
  type,
  amount,
  carried,
  onToggle,
}: {
  type: string
  amount: number | string | undefined
  carried: boolean
  onToggle: (carried: boolean) => void
}) {
  const trait = readReference(
    'AnyNpcDesigner.trait',
    () => SalvageUnionReference.Traits.getByName(type) ?? null,
    null
  )
  const detail = useDetailModal(trait ?? undefined)
  const label = amount === undefined ? type : `${type} (${amount})`
  return (
    <PickRow label={`Carry ${label}`} carried={carried} onToggle={onToggle}>
      {trait ? (
        <ReferenceEntityCard
          data={trait}
          size="medium"
          extent="head"
          titleOverride={label}
          onCardClick={() => detail.control.onClick?.()}
          cardClickLabel={`Open ${label}`}
        />
      ) : (
        <span style={HINT}>{label}</span>
      )}
      {detail.modal}
    </PickRow>
  )
}

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
                <button
                  type="button"
                  style={RESULT_BUTTON}
                  disabled={has}
                  onClick={() => {
                    if (m.kind === 'Action') onAction(slug)
                    else onTrait(m.name)
                    setQuery('')
                  }}
                >
                  <span>{has ? `${m.name} — already listed` : `Add ${m.name}`}</span>
                  <span style={CAPS}>{m.kind}</span>
                </button>
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
  placeholder,
}: {
  form: NpcFormState
  onChange: (patch: Partial<NpcFormState>) => void
  placeholder: string
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
          placeholder={placeholder || 'What they look like, and how they carry themselves.'}
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
