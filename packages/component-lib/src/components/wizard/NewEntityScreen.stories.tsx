import type { Story } from '@ladle/react'
import { useMemo, useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import { Button } from '../chrome/Button'
import { Field, Input, Select } from '../chrome/Field'
import { ModeDoor } from '../chrome/ModeDoor'
import { ModalShell } from '../shared/ModalShell'
import { cn } from '../../utils/cn'
import { Caption } from '../../stories/_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Compositions/Wizard/New Entity Screen' }

/**
 * Mirror of the /new mode router — apps/itun/src/components/wizard/
 * NewEntityScreen.tsx — the router-agnostic shell behind every create route. It
 * composes CreateModeChooser (two `ModeDoor`s under a poster band) and
 * BlankCreateDialog (a `ModalShell` of `Field`/`Input`/`Select`), switching on
 * the `mode` search param:
 *
 *   mode 'guided' → the existing guided wizard, rendered unchanged (slot).
 *   mode absent   → CreateModeChooser (Guided vs Blank doors).
 *   mode 'blank'  → the chooser with BlankCreateDialog open over it.
 *
 * App components can't be imported cross-package, so this reproduces them using
 * the SAME shared primitives the app now consumes (`ModeDoor` + `Select` +
 * `Field`/`Input`/`ModalShell`) — no hand-rolled door/select markup. The app's
 * `createBlank` persistence and `AppLink` are stubbed (a fake id + a plain <a>).
 */

// --- Local mirrors of ITUN app-only types (cannot import from apps). ---
type BlankCreateKind = 'pilot' | 'mech' | 'crawler'
type CreateMode = 'guided' | 'blank' | undefined

const KIND_LABEL: Record<BlankCreateKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

// --- CreateModeChooser (verbatim from apps/.../wizard/CreateModeChooser.tsx). ---
const GUIDED_COPY: Record<BlankCreateKind, { body: string; cite: string }> = {
  pilot: {
    body: 'Step through the Pilot Bay rules, one card at a time — class, abilities, equipment, identity.',
    cite: 'The Pilot Bay begins on p. 18.',
  },
  mech: {
    body: 'Step through the Mech Bay rules, one card at a time — chassis, pattern, systems and modules.',
    cite: 'The Mech Bay begins on p. 94.',
  },
  crawler: {
    body: 'Step through crawler creation, one card at a time — type, armament, crew, identity.',
    cite: 'Union Crawlers begin on p. 212.',
  },
}

function CreateModeChooser({
  kind,
  onGuided,
  onBlank,
}: {
  kind: BlankCreateKind
  onGuided: () => void
  onBlank: () => void
}) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]

  return (
    <section
      className={cn(`sheet--${kind}`, 'min-h-dvh')}
      style={{ background: 'var(--ground)' }}
      aria-label={`New ${label.toLowerCase()} — choose how to create`}
    >
      {/* Poster band: tone ground, white condensed banner, a tone bandtail. */}
      <header
        className="border-b-4 border-paper/95 px-5 pb-3.5 pt-7 sm:px-7"
        style={{ background: 'var(--tone)' }}
      >
        <h1 className="m-0 font-cond text-[clamp(34px,5.2vw,54px)] font-bold uppercase leading-[0.98] tracking-[0.5px] text-paper [text-shadow:0_2px_0_rgba(0,0,0,0.22)]">
          New {label}
        </h1>
      </header>
      <div className="h-2.5" style={{ background: 'var(--tone)' }} aria-hidden="true" />

      <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-8 sm:py-10">
        {/* The two doors — the shared ModeDoor atom (Atoms/Mode Door). */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5">
          <ModeDoor
            variant="guided"
            tab="▶"
            headline="Guided"
            cite={guided.cite}
            onSelect={onGuided}
          >
            {guided.body}
          </ModeDoor>
          <ModeDoor
            variant="blank"
            tab="✎"
            headline="Blank"
            cite="For veterans, imports, and homebrew."
            onSelect={onBlank}
          >
            An empty sheet. No steps, no limits. Fill it in on the live sheet.
          </ModeDoor>
        </div>

        {/* Mech only: the third Blank-family door — Instantiate from Pattern
            (app links via AppLink to /mechs/patterns; a plain <a> stands in). */}
        {kind === 'mech' && (
          <a
            href="/mechs/patterns"
            className="mx-auto mt-6 block w-fit max-w-[92%] rounded-badge bg-ink px-4 py-2 text-center font-cond text-badge font-bold uppercase leading-relaxed tracking-caps-wide text-paper no-underline hover:bg-ink/85"
          >
            A third door in the Blank family —{' '}
            <span className="text-pilot">Instantiate from Pattern</span> · stamp a saved pattern,
            then edit freely
          </a>
        )}
      </div>
    </section>
  )
}

// --- BlankCreateDialog (verbatim from apps/.../wizard/BlankCreateDialog.tsx). ---
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

function BlankCreateDialog({
  kind,
  open,
  onClose,
  onCreated,
}: {
  kind: BlankCreateKind
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [callsign, setCallsign] = useState('')
  const [refPick, setRefPick] = useState('')
  const [techLevel, setTechLevel] = useState(1)
  const [pending, setPending] = useState(false)
  const [error] = useState<string | null>(null)

  const label = KIND_LABEL[kind]
  const pickOptions = useMemo(
    () => (kind === 'pilot' ? classOptions() : kind === 'mech' ? chassisOptions() : []),
    [kind]
  )
  const tlOptions = useMemo(() => (kind === 'crawler' ? techLevelOptions() : []), [kind])

  const canSubmit = name.trim() !== '' && (kind !== 'pilot' || callsign.trim() !== '')

  function handleCreate() {
    setPending(true)
    // App wires createBlank (IndexedDB persistence); stubbed here as a fake id.
    onCreated(`preview-${kind}`)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`Blank ${label}`}
      maxWidth="max-w-md"
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

        {error && (
          <p className="m-0 font-body text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
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

// --- NewEntityScreen router (verbatim logic from apps/.../wizard/NewEntityScreen.tsx). ---
function NewEntityScreen({
  kind,
  initialMode,
}: {
  kind: BlankCreateKind
  initialMode: CreateMode
}) {
  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [createdId, setCreatedId] = useState<string | null>(null)

  if (mode === 'guided') {
    // The app passes the EXISTING guided wizard here UNCHANGED via the `wizard`
    // slot; a placeholder stands in so the router's guided branch is visible.
    return (
      <section
        className={cn(`sheet--${kind}`, 'min-h-[220px]')}
        style={{ background: 'var(--ground)' }}
      >
        <div className="grid min-h-[220px] place-items-center p-8">
          <p className="max-w-md text-center font-body text-sm text-ink-2">
            <span className="font-cond font-bold uppercase tracking-caps text-ink">
              Guided {KIND_LABEL[kind]} wizard
            </span>{' '}
            — the existing step wizard, rendered unchanged in the `wizard` slot.
          </p>
        </div>
        <div className="p-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setMode(undefined)}>
            ← Back to the doors
          </Button>
        </div>
      </section>
    )
  }

  return (
    <>
      <CreateModeChooser
        kind={kind}
        onGuided={() => setMode('guided')}
        onBlank={() => setMode('blank')}
      />
      <BlankCreateDialog
        kind={kind}
        open={mode === 'blank'}
        onClose={() => setMode(undefined)}
        onCreated={(id) => {
          setCreatedId(id)
          setMode(undefined)
        }}
      />
      <p className="px-6 pb-6 font-body text-caption text-ink-2" aria-live="polite">
        Created id: {createdId ?? 'none'}
      </p>
    </>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-8">
    <Caption>
      The /new mode router (ITUN NewEntityScreen) — composes CreateModeChooser (two shared
      ModeDoors) + BlankCreateDialog (shared Field/Input/Select in a ModalShell) on the `mode`
      param. Click Blank to open the dialog (real SRD class/chassis/tech-level options); click
      Guided for the wizard-slot placeholder.
    </Caption>

    <div>
      <Caption>Pilot — opens on the doors; Blank collects Name + Callsign + optional class</Caption>
      <NewEntityScreen kind="pilot" initialMode={undefined} />
    </div>

    <div>
      <Caption>Mech — Blank collects Name + optional chassis (any Tech Level)</Caption>
      <NewEntityScreen kind="mech" initialMode={undefined} />
    </div>

    <div>
      <Caption>Crawler — starts in blank mode; dialog collects Name + Tech Level</Caption>
      <NewEntityScreen kind="crawler" initialMode="blank" />
    </div>
  </div>
)
