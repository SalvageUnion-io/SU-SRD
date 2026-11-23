/**
 * AnyNpcDesigner — design an NPC (`docs/architecture/npc-builder.md` §4.1),
 * beside a live preview of its card. A template is Template, then one page:
 * the name first, its stats and actions below, and Save (r6 B3). A blank start
 * keeps the steps (Template, Stats, Actions & traits, Identity). The preview
 * is the card, so there is no Review step.
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
 *
 * `NpcRedesigner` is the same designer opened on a saved NPC (its sheet's
 * "Redesign from a template", r6 B12): Template and the one page, the form
 * filled from the NPC, and Save writes that NPC in place (`saveNpcRedesign`),
 * never a new one.
 */

import type { Npc, NpcTemplateKind, NpcTemplateRef } from 'game-domain/schemas/npc'
import { NPC_TEMPLATE_KINDS, NpcSchema } from 'game-domain/schemas/npc'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { ConfirmDialog, FieldError, Grid } from '../../components/app'
import {
  Button,
  Entity,
  ModalShell,
  RadioCardGroup,
  SearchField,
  Segmented,
  SegmentedOption,
  TitledBox,
} from '../../components/index'
import type { DenizenTemplate } from '../../lib/npcs/npcModel'
import { DENIZEN_KIND_LABEL, denizenTemplate, isDenizenKind } from '../../lib/npcs/npcModel'
import { readReference } from '../../lib/readReference'
import { npcCreationStepGate } from '../../lib/rules/creation'
import type { NpcFormState, NpcStepId } from '../../lib/wizard/npcFormState'
import {
  applyBlankStart,
  applyNpcTemplate,
  EMPTY_NPC_FORM,
  NPC_STEP_LABELS,
  NPC_STEPS,
  NPC_TEMPLATE_STEPS,
  npcFormFromNpc,
  npcFormToCreateInput,
  npcFormView,
  statsEditedSinceFill,
} from '../../lib/wizard/npcFormState'
import { npcCopy } from '../../messages/build-npc'
import { useSync } from '../../replica/syncContext'
import type { WizardDraft } from '../wizard/useWizardDraft'
import { useWizardDraft } from '../wizard/useWizardDraft'
import { useWizardFlow } from '../wizard/useWizardFlow'
import { WizShell } from '../wizard/WizShell'
import { NpcCard } from './NpcCard'
import {
  NpcActionsFields,
  NpcIdentityFields,
  NpcNameField,
  NpcStatsFields,
} from './NpcDesignFields'
import { CAPS, CAPS_LABEL, COLUMN, HINT, LIST, NOTE, NPC_NAME_ID, ROW } from './npcStyles.model'
import { saveNpcRedesign } from './redesign.model'

const STEP_INTRO: Record<NpcStepId, string> = {
  template: npcCopy('introTemplate'),
  stats: npcCopy('introStats'),
  actions: npcCopy('introActions'),
  identity: npcCopy('introIdentity'),
  design: npcCopy('introDesign'),
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
  /** The Game the new NPC is made in (`?game=`, from that Game's Prep); unset, the Kit. */
  gameId?: string | undefined
}

/** A template waiting to be applied: the denizen and the kind it is. */
type Start = { schema: NpcTemplateKind; entity: DenizenTemplate }

export function AnyNpcDesigner(props: AnyNpcDesignerProps) {
  const draft = useWizardDraft<NpcFormState>('npc', { baseline: EMPTY_NPC_FORM })
  return <NpcDesignerSteps {...props} draft={draft} />
}

/** The designer on a saved NPC: its stats, actions and identity, saved in place. */
export function NpcRedesigner({
  npc,
  madeBy,
  onSaved,
  onCancel,
}: {
  npc: Npc
  madeBy: string
  /** The redesign was saved onto the NPC. */
  onSaved: (npcId: string) => void
  onCancel: () => void
}) {
  // The NPC as it stood when the designer opened: saving it must not restart the form.
  const [baseline] = useState(() => npcFormFromNpc(npc))
  const [form, setForm] = useState(baseline)
  const formDirty = JSON.stringify(form) !== JSON.stringify(baseline)
  return (
    <NpcDesignerSteps
      madeBy={madeBy}
      onCreated={onSaved}
      onCancel={onCancel}
      draft={{ form, setForm, formDirty, draftKey: `su-npc-redesign:${npc.id}` }}
      existing={npc}
    />
  )
}

function NpcDesignerSteps({
  madeBy,
  onCreated,
  onCancel,
  startFrom,
  gameId,
  draft,
  existing,
}: AnyNpcDesignerProps & {
  draft: WizardDraft<NpcFormState>
  /** The saved NPC being redesigned; absent, a new one is designed. */
  existing?: Npc
}) {
  const { canWrite } = useSync()
  const { form, setForm, formDirty, draftKey } = draft
  /** A restart waiting on the player's yes: a template, or `'blank'` (D4). */
  const [pendingStart, setPendingStart] = useState<Start | 'blank' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // A template (or a saved NPC) is one page after Template; a blank start, the steps (r6 B3).
  const onePage = existing !== undefined || form.templateRef !== null
  const flow = useWizardFlow<NpcStepId, NpcFormState, 'npc'>({
    entityType: 'npc',
    noun: 'NPC',
    steps: onePage ? NPC_TEMPLATE_STEPS : NPC_STEPS,
    stepLabels: NPC_STEP_LABELS,
    gateFor: (s) => npcCreationStepGate(s, form),
    initialStep: 'template',
    submitStep: onePage ? 'design' : 'identity',
    form,
    draftKey,
    formDirty,
    schema: NpcSchema,
    toCreateInput: npcFormToCreateInput,
    failureMessage: npcCopy('theNpcCouldNotBe'),
    onComplete: onCreated,
    onCancel,
    gameId,
    existing: existing
      ? { id: existing.id, save: (next) => saveNpcRedesign(existing, next) }
      : undefined,
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
  const writesBlocked = step === (onePage ? 'design' : 'identity') && !canWrite

  return (
    <>
      {/* The one wizard (hard rule R16): WizShell's rail, step head and action
          pill, under the designer page's own band (its Any NPC | Crawler crew
          tabs). The step sits beside its live preview. */}
      <WizShell
        kind="npc"
        eyebrow={existing ? npcCopy('denizensEditDesign') : npcCopy('denizensNewNpc')}
        band={false}
        {...shell}
        nextDisabled={shell.nextDisabled || writesBlocked}
        title={NPC_STEP_LABELS[step]}
        footerNote={!gate.ok ? gate.reason : undefined}
        // The template is chosen: the name is what is left to ask (r6 B3).
        focusId={step === 'design' ? NPC_NAME_ID : undefined}
        submitLabel={existing ? npcCopy('saveChanges') : npcCopy('saveNpc')}
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
            <p style={HINT}>
              {existing && step === 'design' ? npcCopy('introDesignRedesign') : STEP_INTRO[step]}
            </p>
            <Button
              variant="ghost"
              size="compact"
              className="su-npc-preview-toggle"
              onClick={() => setPreviewOpen(true)}
            >
              {npcCopy('preview')}
            </Button>

            {step === 'template' && (
              <TemplateStep form={form} onTemplate={chooseTemplate} onBlank={chooseBlank} />
            )}
            {step === 'stats' && <NpcStatsFields form={form} onChange={update} />}
            {step === 'actions' && <NpcActionsFields form={form} onChange={setForm} />}
            {step === 'identity' && <NpcIdentityFields form={form} onChange={update} />}
            {step === 'design' && (
              <>
                <NpcNameField form={form} onChange={update} />
                <TitledBox title={NPC_STEP_LABELS.stats}>
                  <NpcStatsFields form={form} onChange={update} />
                </TitledBox>
                <TitledBox title={NPC_STEP_LABELS.actions}>
                  <NpcActionsFields form={form} onChange={setForm} />
                </TitledBox>
                <TitledBox title={NPC_STEP_LABELS.identity}>
                  <NpcIdentityFields form={form} onChange={update} withName={false} />
                </TitledBox>
              </>
            )}

            {submitError && <FieldError>{submitError}</FieldError>}
          </section>

          <section className="su-npc-preview" aria-label={npcCopy('livePreview')}>
            <p className={CAPS_LABEL} style={CAPS}>
              {npcCopy('livePreviewHowItWill')}
            </p>
            {preview}
            <p style={NOTE}>
              <strong>{npcCopy('yoursNotTheBooks')}</strong> {npcCopy('aDesignedNpcKeeps')}
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
            : npcCopy('startAgainFrom', {
                name: pendingStart?.entity.name ?? npcCopy('thisTemplate'),
              })
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
            {DENIZEN_KIND_LABEL[k]}
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
