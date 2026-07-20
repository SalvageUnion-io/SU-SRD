/**
 * BlankCreateDialog — collects ONLY the Zod-required fields (plus the
 * optional escape-valve pick) for a Blank create, then persists via
 * createBlank and hands the new id back to the route (wizard-refresh Phase 1).
 *
 *   Pilot:   Name*, Callsign*, optional class (UNFILTERED — all classes
 *            including specialisations).
 *   Mech:    Name*, optional chassis (UNFILTERED — any Tech Level, no
 *            scrap cost).
 *   Crawler: Name*, Tech Level 1–6 (default 1 — bare stats derive from
 *            crawler-tech-levels.json; the default SRD bays are seeded).
 *
 * Reuses the app's standard dialog shell (component-lib ModalShell — the same
 * shell behind ConfirmDialog/SelectorDialog) and Field/Input chrome.
 */

import { useMemo, useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import { Button, Field, Input, ModalShell, Select, FieldError } from 'component-lib'

import { createBlank } from '../../lib/wizard/blankCreate'
import type { BlankCreateKind } from '../../lib/wizard/blankCreate'

type BlankCreateDialogProps = {
  kind: BlankCreateKind
  open: boolean
  /** Dismissed without creating — navigate back to the chooser. */
  onClose: () => void
  /** Created — navigate to /sheet/{kind}/{id}. */
  onCreated: (id: string) => void
}

const KIND_LABEL: Record<BlankCreateKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

type RefOption = { value: string; label: string }

/** All classes, id-valued — deliberately unfiltered (incl. specialisations). */
function classOptions(): RefOption[] {
  try {
    const all = SalvageUnionReference.Classes.all() as ReadonlyArray<{ id: string; name: string }>
    return all.map((c) => ({ value: c.id, label: c.name }))
  } catch {
    return []
  }
}

/** Sortable rank for a chassis TL (non-numeric TLs — Bio/Nanite — sort last). */
function tlRank(tl: unknown): number {
  return typeof tl === 'number' ? tl : Number.POSITIVE_INFINITY
}

/** All chassis, slug-valued — any Tech Level, labelled with its TL. */
function chassisOptions(): RefOption[] {
  try {
    const all = SalvageUnionReference.Chassis.all()
    return [...all]
      .sort((a, b) => tlRank(a.techLevel) - tlRank(b.techLevel) || a.name.localeCompare(b.name))
      .map((c) => ({
        value: nameToSlug(c.name),
        label: `${c.name} · TL ${String(c.techLevel)}`,
      }))
  } catch {
    return []
  }
}

/** The six crawler tech levels, numeric-valued, labelled with their names. */
function techLevelOptions(): RefOption[] {
  try {
    const all = SalvageUnionReference.CrawlerTechLevels.all()
    return [...all]
      .sort((a, b) => a.techLevel - b.techLevel)
      .map((t) => ({ value: String(t.techLevel), label: `TL ${t.techLevel} · ${t.name}` }))
  } catch {
    return []
  }
}

export function BlankCreateDialog({ kind, open, onClose, onCreated }: BlankCreateDialogProps) {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  /** Optional class/chassis ref ('' = decide later on the sheet). */
  const [refPick, setRefPick] = useState('')
  const [techLevel, setTechLevel] = useState(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = KIND_LABEL[kind]
  const pickOptions = useMemo(
    () => (kind === 'pilot' ? classOptions() : kind === 'mech' ? chassisOptions() : []),
    [kind]
  )
  const tlOptions = useMemo(() => (kind === 'crawler' ? techLevelOptions() : []), [kind])

  const canSubmit = name.trim() !== '' && (kind !== 'pilot' || callsign.trim() !== '')

  async function handleCreate() {
    setPending(true)
    setError(null)
    try {
      let id: string
      if (kind === 'pilot') {
        id = await createBlank('pilot', {
          name: name.trim(),
          callsign: callsign.trim(),
          ...(refPick !== '' ? { classRef: refPick } : {}),
        })
      } else if (kind === 'mech') {
        id = await createBlank('mech', {
          name: name.trim(),
          ...(refPick !== '' ? { chassisRef: refPick } : {}),
        })
      } else {
        id = await createBlank('crawler', { name: name.trim(), techLevel })
      }
      onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${label.toLowerCase()}.`)
      setPending(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Blank ${label}`}
      headerBg="bg-su-orange"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        <p className="m-0 font-body text-sm text-wk-muted">
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

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={pending || !canSubmit}
            aria-label={`Create blank ${label.toLowerCase()}`}
          >
            {pending ? 'Creating…' : `Create ${label}`}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
