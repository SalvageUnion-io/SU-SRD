/**
 * BlankCreateDialog — collects ONLY the Zod-required fields (plus the
 * optional escape-valve pick) for a Blank create, then persists via
 * createBlank and hands the new id back to the route.
 *
 *   Pilot:   Name*, Callsign (blank: the Name, r6 F5), optional class (UNFILTERED — all classes
 *            including specialisations).
 *   Mech:    optional chassis, in the Ledger picker (UNFILTERED — any Tech
 *            Level, no scrap cost); its name can wait for the sheet.
 *   Crawler: Name*, Tech Level 1–6 (default 1 — bare stats derive from
 *            crawler-tech-levels.json; the default SRD bays are seeded).
 *
 * Reuses the app's standard dialog shell (src/components ModalShell — the same
 * shell behind the UI library's ConfirmDialog) and Field/Input chrome.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DialogActions, FieldError } from '../../components/app'
import { Button, Field, Input, ModalShell, Select } from '../../components/index'
import { focusHeadingOnArrival } from '../../lib/arrivalFocus'
import { useServerAction } from '../../lib/connection/useServerAction'
import { readReference } from '../../lib/readReference'
import { createBlank } from '../../lib/wizard/blankCreate'
import { storedCallsign } from '../../lib/wizard/pilotFormState'
import '../../styles/build/wizard.css'
import { mechCopy } from '../../messages/build-mech'
import { buildWizardCopy } from '../../messages/build-wizard'
import { useSheetModeStore } from '../sheet/sheetMode.model'
import { BlankChassisPick } from './BlankChassisPick'
import { dialogBodyStyle, dialogNoteStyle } from './wizardStyles.model'

const noteStyle = { ...dialogNoteStyle, margin: 0 } satisfies CSSProperties

type BlankCreateDialogProps = {
  kind: SheetKind
  open: boolean
  /** Dismissed without creating — navigate back to the chooser. */
  onClose: () => void
  /** Created — navigate to /{kind}s/{id}. */
  onCreated: (id: string) => void
  /** The Game the new unit lands in (`?game=<id>`, ADR-052 §3); unset, the store decides. */
  gameId?: string | undefined
  /** A mech's chassis, by slug, picked already (a chassis page's Build With This, r5 D8). */
  chassis?: string | undefined
}

const KIND_LABEL: Record<SheetKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

type RefOption = { value: string; label: string }

/** All classes, id-valued — deliberately unfiltered (incl. specialisations). */
function classOptions(): RefOption[] {
  return readReference(
    'BlankCreateDialog.classOptions',
    () => SalvageUnionReference.Classes.all().map((c) => ({ value: c.id, label: c.name })),
    []
  )
}

/** The six crawler tech levels, numeric-valued, labelled with their names. */
function techLevelOptions(): RefOption[] {
  return readReference(
    'BlankCreateDialog.techLevelOptions',
    () =>
      [...SalvageUnionReference.CrawlerTechLevels.all()]
        .sort((a, b) => a.techLevel - b.techLevel)
        .map((t) => ({
          value: String(t.techLevel),
          label: buildWizardCopy('tl2', { techLevel: t.techLevel, name: t.name }),
        })),
    []
  )
}

export function BlankCreateDialog({
  kind,
  open,
  onClose,
  onCreated,
  gameId,
  chassis,
}: BlankCreateDialogProps) {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  /** Optional class/chassis ref ('' = decide later on the sheet); a chassis page's link picks its own. */
  const [refPick, setRefPick] = useState(() =>
    kind === 'mech' && chassis !== undefined && SalvageUnionReference.Chassis.getBySlug(chassis)
      ? chassis
      : ''
  )
  const [techLevel, setTechLevel] = useState(1)

  const label = KIND_LABEL[kind]
  const pickOptions = useMemo(() => (kind === 'pilot' ? classOptions() : []), [kind])
  const tlOptions = useMemo(() => (kind === 'crawler' ? techLevelOptions() : []), [kind])

  // A mech's name can wait for the sheet: it starts as its chassis's, or unnamed.
  // A blank Callsign is the Name (r6 F5).
  const canSubmit = kind === 'mech' || name.trim() !== ''
  // A disabled Create says what it waits for (MD4-22).
  const missing = canSubmit ? null : buildWizardCopy('addANameToCreate')
  const mechName = (pick: string) =>
    name.trim() ||
    (pick !== '' ? SalvageUnionReference.Chassis.getBySlug(pick)?.name : undefined) ||
    mechCopy('unnamedMech')

  const create = useServerAction(
    // `pick`: the chassis Enter took in the search, ahead of the state it set.
    (pick: string = refPick) => {
      if (kind === 'pilot') {
        return createBlank(
          'pilot',
          {
            name: name.trim(),
            callsign: storedCallsign(callsign, name),
            ...(refPick !== '' ? { classRef: refPick } : {}),
          },
          { gameId }
        )
      }
      if (kind === 'mech') {
        return createBlank(
          'mech',
          { name: mechName(pick), ...(pick !== '' ? { chassisRef: pick } : {}) },
          { gameId }
        )
      }
      return createBlank('crawler', { name: name.trim(), techLevel }, { gameId })
    },
    { failure: buildWizardCopy('blankNotCreated', { label: label.toLowerCase() }) }
  )
  const { pending, error } = create

  // Typing starts in the first field, never on Close (MD2-04): the name, or a
  // mech's chassis search (r4 E14).
  const nameField = useRef<HTMLInputElement | null>(null)
  const chassisSearch = useRef<HTMLInputElement | null>(null)

  async function handleCreate(pick?: string) {
    const result = await create.run(pick)
    if (!result.ok) return
    // A blank sheet has nothing to read: it opens in Edit, on its prompts.
    useSheetModeStore.getState().setEditing(true)
    focusHeadingOnArrival()
    onCreated(result.value)
  }

  /** Enter in a text field is Create, once the dialog can be created (MD3-04). */
  function createOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !pending && canSubmit) void handleCreate()
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={buildWizardCopy('blank', { label })}
      width={kind === 'mech' ? 'default' : 'narrow'}
      initialFocus={kind === 'mech' ? chassisSearch : nameField}
    >
      <div style={dialogBodyStyle}>
        <p style={noteStyle}>{buildWizardCopy('anEmptySheetNoSteps')}</p>

        {kind === 'mech' && (
          <BlankChassisPick
            value={refPick}
            onChange={setRefPick}
            searchRef={chassisSearch}
            onEnter={(pick) => {
              if (!pending) void handleCreate(pick)
            }}
          />
        )}

        <Field
          label={kind === 'mech' ? buildWizardCopy('nameOptional') : buildWizardCopy('name')}
          required={kind !== 'mech'}
          htmlFor={`blank-${kind}-name`}
        >
          <Input
            ref={nameField}
            id={`blank-${kind}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={createOnEnter}
            placeholder={
              kind === 'mech' ? buildWizardCopy('nameItLaterOnTheSheet') : `${label} name`
            }
            autoComplete="off"
          />
        </Field>

        {kind === 'pilot' && (
          <Field label={buildWizardCopy('callsign')} htmlFor="blank-pilot-callsign">
            <Input
              id="blank-pilot-callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              onKeyDown={createOnEnter}
              placeholder={name.trim() || buildWizardCopy('callsign')}
              autoComplete="off"
            />
          </Field>
        )}

        {kind === 'pilot' && (
          <Field label={buildWizardCopy('classOptional')} htmlFor={`blank-${kind}-pick`}>
            <Select
              id={`blank-${kind}-pick`}
              value={refPick}
              onChange={(e) => setRefPick(e.target.value)}
            >
              <option value="">{buildWizardCopy('noneDecideOnTheSheet')}</option>
              {pickOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {kind === 'crawler' && (
          <Field label={buildWizardCopy('techLevel')} htmlFor="blank-crawler-tl">
            <Select
              id="blank-crawler-tl"
              value={String(techLevel)}
              onChange={(e) => setTechLevel(Number(e.target.value))}
            >
              {tlOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {error && <FieldError>{error}</FieldError>}

        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onClose} disabled={pending}>
            {buildWizardCopy('cancel')}
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={() => void handleCreate()}
            disabled={pending || !canSubmit}
          >
            {pending
              ? buildWizardCopy('creating')
              : (missing ?? buildWizardCopy('create', { label }))}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
