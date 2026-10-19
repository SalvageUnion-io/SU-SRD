/**
 * BlankCreateDialog — collects ONLY the Zod-required fields (plus the
 * optional escape-valve pick) for a Blank create, then persists via
 * createBlank and hands the new id back to the route.
 *
 *   Pilot:   Name*, Callsign*, optional class (UNFILTERED — all classes
 *            including specialisations).
 *   Mech:    Name*, optional chassis (UNFILTERED — any Tech Level, no
 *            scrap cost).
 *   Crawler: Name*, Tech Level 1–6 (default 1 — bare stats derive from
 *            crawler-tech-levels.json; the default SRD bays are seeded).
 *
 * Reuses the app's standard dialog shell (src/components ModalShell — the same
 * shell behind the UI library's ConfirmDialog) and Field/Input chrome.
 */

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { byTechLevelThenName, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import {
  Button,
  DialogActions,
  Field,
  FieldError,
  Input,
  ModalShell,
  Select,
} from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { readReference } from '../../lib/readReference'
import type { BlankCreateKind } from '../../lib/wizard/blankCreate'
import { createBlank } from '../../lib/wizard/blankCreate'
import '../../styles/build/wizard.css'
import { dialogBodyStyle, dialogNoteStyle } from './wizardStyles.model'

const noteStyle = { ...dialogNoteStyle, margin: 0 } satisfies CSSProperties

type BlankCreateDialogProps = {
  kind: BlankCreateKind
  open: boolean
  /** Dismissed without creating — navigate back to the chooser. */
  onClose: () => void
  /** Created — navigate to /sheet/{kind}/{id}. */
  onCreated: (id: string) => void
  /** The Game the new unit lands in (`?game=<id>`, ADR-052 §3); unset, the store decides. */
  gameId?: string | undefined
}

const KIND_LABEL: Record<BlankCreateKind, string> = {
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

/** All chassis, slug-valued — any Tech Level, labelled with its TL. */
function chassisOptions(): RefOption[] {
  return readReference(
    'BlankCreateDialog.chassisOptions',
    () =>
      [...SalvageUnionReference.Chassis.all()]
        .sort((a, b) => byTechLevelThenName(a, b))
        .map((c) => ({
          value: nameToSlug(c.name),
          label: `${c.name} · TL ${String(c.techLevel)}`,
        })),
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
        .map((t) => ({ value: String(t.techLevel), label: `TL ${t.techLevel} · ${t.name}` })),
    []
  )
}

export function BlankCreateDialog({
  kind,
  open,
  onClose,
  onCreated,
  gameId,
}: BlankCreateDialogProps) {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  /** Optional class/chassis ref ('' = decide later on the sheet). */
  const [refPick, setRefPick] = useState('')
  const [techLevel, setTechLevel] = useState(1)

  const label = KIND_LABEL[kind]
  const pickOptions = useMemo(
    () => (kind === 'pilot' ? classOptions() : kind === 'mech' ? chassisOptions() : []),
    [kind]
  )
  const tlOptions = useMemo(() => (kind === 'crawler' ? techLevelOptions() : []), [kind])

  const canSubmit = name.trim() !== '' && (kind !== 'pilot' || callsign.trim() !== '')

  const create = useServerAction(
    () => {
      if (kind === 'pilot') {
        return createBlank(
          'pilot',
          {
            name: name.trim(),
            callsign: callsign.trim(),
            ...(refPick !== '' ? { classRef: refPick } : {}),
          },
          { gameId }
        )
      }
      if (kind === 'mech') {
        return createBlank(
          'mech',
          { name: name.trim(), ...(refPick !== '' ? { chassisRef: refPick } : {}) },
          { gameId }
        )
      }
      return createBlank('crawler', { name: name.trim(), techLevel }, { gameId })
    },
    { failure: `The ${label.toLowerCase()} could not be created. Try again.` }
  )
  const { pending, error } = create

  async function handleCreate() {
    const result = await create.run()
    if (result.ok) onCreated(result.value)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Blank ${label}`}
      width="narrow"
    >
      <div style={dialogBodyStyle}>
        <p style={noteStyle}>
          An empty sheet — no steps, no limits. Fill in the rest on the live sheet.
        </p>

        <Field label="Name" required htmlFor={`blank-${kind}-name`}>
          <Input
            id={`blank-${kind}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${label} name`}
            autoComplete="off"
          />
        </Field>

        {kind === 'pilot' && (
          <Field label="Callsign" required htmlFor="blank-pilot-callsign">
            <Input
              id="blank-pilot-callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Callsign"
              autoComplete="off"
            />
          </Field>
        )}

        {(kind === 'pilot' || kind === 'mech') && (
          <Field
            label={kind === 'pilot' ? 'Class (optional)' : 'Chassis (optional)'}
            htmlFor={`blank-${kind}-pick`}
          >
            <Select
              id={`blank-${kind}-pick`}
              value={refPick}
              onChange={(e) => setRefPick(e.target.value)}
            >
              <option value="">None — decide on the sheet</option>
              {pickOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {kind === 'crawler' && (
          <Field label="Tech Level" htmlFor="blank-crawler-tl">
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
            Cancel
          </Button>
          <Button
            variant="primary"
            size="compact"
            onClick={() => void handleCreate()}
            disabled={pending || !canSubmit}
            aria-label={`Create blank ${label.toLowerCase()}`}
          >
            {pending ? 'Creating…' : `Create ${label}`}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
