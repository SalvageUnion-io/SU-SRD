import type { Story } from '@ladle/react'
import { useState } from 'react'
import { cn } from '../../utils/cn'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Create Mode Doors' }

// Local mirror of ITUN's BlankCreateKind (app-only type; cannot import from apps).
type BlankCreateKind = 'pilot' | 'mech' | 'crawler'

const KIND_LABEL: Record<BlankCreateKind, string> = {
  pilot: 'Pilot',
  mech: 'Mech',
  crawler: 'Crawler',
}

/** Guided-door copy + Core Book citation per kind (mockup Screen 04). */
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

/** Shared door frame (mockup `.door`) — the two variants restyle it below. */
const DOOR_CLASS =
  'relative min-h-[170px] cursor-pointer rounded-xl p-[22px] pb-5 pl-[26px] text-left transition-transform duration-[120ms] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rust/[0.22]'

/** Black notched tab overhanging the door's left edge (mockup `.dtab`). */
const DTAB_CLASS =
  'absolute -left-3.5 top-[18px] grid h-12 w-11 place-items-center rounded-[2px] bg-ink font-cond text-[22px] font-bold text-paper shadow-[0_8px_14px_-8px_rgba(0,0,0,0.55)]'

/** Condensed-caps door heading (mockup `.dhead`). */
const DHEAD_CLASS =
  'mb-1.5 ml-[34px] block font-cond text-[27px] font-bold uppercase leading-none tracking-caps-tight'

const DBODY_CLASS = 'ml-[34px] block font-body text-[13px] leading-[1.55]'
const DCITE_CLASS = 'ml-[34px] mt-2.5 block font-body text-[12.5px] font-bold'

/**
 * Verbatim reproduction of the onboarding "door" cards from
 * apps/in-the-union-now/src/components/wizard/CreateModeChooser.tsx. The GUIDED
 * door is a custom double-ink-ring button, BLANK is a dashed empty door, and
 * the mech-only third door is a `bg-ink … uppercase … text-paper` CTA. ITUN's
 * app-only AppLink is inlined here as a trivial <a>.
 */
function LegacyCreateModeChooser({ kind }: { kind: BlankCreateKind }) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]
  const [chosen, setChosen] = useState<'guided' | 'blank' | null>(null)

  return (
    <section
      className={cn(`sheet--${kind}`, 'min-h-dvh')}
      style={{ background: 'var(--ground)' }}
      aria-label={`New ${label.toLowerCase()} — choose how to create`}
    >
      {/* Poster band (mockup `.band` + `.banner`): tone ground, white
          condensed banner, a white rule then a tone bandtail below it. */}
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
        {/* The two doors (mockup `.choosegrid`). */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5">
          {/* GUIDED — primary: filled in the section tone, double ink ring. */}
          <button
            type="button"
            onClick={() => setChosen('guided')}
            className={cn(
              DOOR_CLASS,
              'shadow-[0_0_0_3px_var(--ground),0_0_0_7px_var(--color-ink),0_18px_30px_-14px_rgba(0,0,0,0.5)]'
            )}
            style={{ background: 'var(--tone)' }}
          >
            <span className={DTAB_CLASS} aria-hidden="true">
              ▶
            </span>
            <span className={cn(DHEAD_CLASS, 'text-paper [text-shadow:0_1px_0_rgba(0,0,0,0.38)]')}>
              Guided
            </span>
            <span className={cn(DBODY_CLASS, 'text-ink')}>{guided.body}</span>
            <span className={cn(DCITE_CLASS, 'text-ink')}>{guided.cite}</span>
          </button>

          {/* BLANK — the escape hatch: dashed empty door on paper. */}
          <button
            type="button"
            onClick={() => setChosen('blank')}
            className={cn(
              DOOR_CLASS,
              'border-entity border-dashed border-ink/55 bg-paper text-ink shadow-[0_14px_26px_-14px_rgba(0,0,0,0.4)]'
            )}
          >
            <span className={DTAB_CLASS} aria-hidden="true">
              ✎
            </span>
            <span className={cn(DHEAD_CLASS, 'text-ink')}>Blank</span>
            <span className={DBODY_CLASS}>
              An empty sheet. No steps, no limits. Fill it in on the live sheet.
            </span>
            <span className={DCITE_CLASS}>For veterans, imports, and homebrew.</span>
          </button>
        </div>

        {/* Mech only: the third Blank-family door — Instantiate from Pattern
            (mockup `.thirdnote`, made actionable: links to the existing
            /mechs/patterns flow). ITUN's AppLink inlined as a plain <a>. */}
        {kind === 'mech' && (
          <a
            href="/mechs/patterns"
            className="mx-auto mt-6 block w-fit max-w-[92%] rounded-[2px] bg-ink px-4 py-2 text-center font-cond text-[11px] font-bold uppercase leading-relaxed tracking-widest text-paper no-underline hover:bg-ink/85"
          >
            A third door in the Blank family —{' '}
            <span className="text-su-orange">Instantiate from Pattern</span> · stamp a saved
            pattern, then edit freely
          </a>
        )}

        <p className="mt-4 font-body text-caption text-ink-2" aria-live="polite">
          Chosen door: {chosen ?? 'none'}
        </p>
      </div>
    </section>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-8">
    <Caption>
      Legacy · app-specific onboarding "door" chooser (ITUN CreateModeChooser) — bg-ink stamps
      (Badge) + dashed door (EmptyState) atoms it could borrow. Click a door to select.
    </Caption>

    <div>
      <Caption>Mech — includes the third "Instantiate from Pattern" door</Caption>
      <LegacyCreateModeChooser kind="mech" />
    </div>

    <div>
      <Caption>Pilot — two doors only</Caption>
      <LegacyCreateModeChooser kind="pilot" />
    </div>

    <div>
      <Caption>Crawler — two doors only</Caption>
      <LegacyCreateModeChooser kind="crawler" />
    </div>
  </div>
)
