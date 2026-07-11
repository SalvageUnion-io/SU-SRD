/**
 * CreateModeChooser — the "which door?" screen every /new opens on
 * (wizard-refresh Phase 1, mockup Screen 04).
 *
 * Two manual-style doors under a poster band: GUIDED (primary — the existing
 * step wizard) and BLANK (the escape hatch — an empty sheet, no steps, no
 * limits). For mechs a third door joins the Blank family: Instantiate from
 * Pattern, which links to the existing /mechs/patterns flow.
 *
 * Styling reuses the live sheets' poster language — the `.sheet--{kind}` tone
 * ground, ink stamps, and the hero band idiom from LiveSheet/SheetHero — so
 * the chooser reads as a sibling surface, not a bolted-on screen.
 */

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

import type { BlankCreateKind } from '../../lib/wizard/blankCreate'

type CreateModeChooserProps = {
  kind: BlankCreateKind
  /** Chosen the Guided door — navigate to ?mode=guided. */
  onGuided: () => void
  /** Chosen the Blank door — navigate to ?mode=blank. */
  onBlank: () => void
}

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
  'absolute -left-3.5 top-[18px] grid h-12 w-11 place-items-center rounded-[2px] bg-ink font-cond text-[22px] font-bold text-su-white shadow-[0_8px_14px_-8px_rgba(0,0,0,0.55)]'

/** Condensed-caps door heading (mockup `.dhead`). */
const DHEAD_CLASS =
  'mb-1.5 ml-[34px] block font-cond text-[27px] font-bold uppercase leading-none tracking-[0.04em]'

const DBODY_CLASS = 'ml-[34px] block font-body text-[13px] leading-[1.55]'
const DCITE_CLASS = 'ml-[34px] mt-2.5 block font-body text-[12.5px] font-bold'

export function CreateModeChooser({ kind, onGuided, onBlank }: CreateModeChooserProps) {
  const label = KIND_LABEL[kind]
  const guided = GUIDED_COPY[kind]

  return (
    <section
      className={cn(`sheet--${kind}`, 'min-h-dvh')}
      style={{ background: 'var(--ground)' }}
      aria-label={`New ${label.toLowerCase()} — choose how to create`}
    >
      {/* Poster band (mockup `.band` + `.banner`): tone ground, white
          condensed banner, a white rule then a tone bandtail below it. */}
      <header
        className="border-b-4 border-su-white/95 px-5 pb-3.5 pt-7 sm:px-7"
        style={{ background: 'var(--tone)' }}
      >
        <h1 className="m-0 font-cond text-[clamp(34px,5.2vw,54px)] font-bold uppercase leading-[0.98] tracking-[0.5px] text-su-white [text-shadow:0_2px_0_rgba(0,0,0,0.22)]">
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
            onClick={onGuided}
            className={cn(
              DOOR_CLASS,
              'shadow-[0_0_0_3px_var(--ground),0_0_0_7px_var(--color-ink),0_18px_30px_-14px_rgba(0,0,0,0.5)]'
            )}
            style={{ background: 'var(--tone)' }}
          >
            <span className={DTAB_CLASS} aria-hidden="true">
              ▶
            </span>
            <span
              className={cn(DHEAD_CLASS, 'text-su-white [text-shadow:0_1px_0_rgba(0,0,0,0.38)]')}
            >
              Guided
            </span>
            <span className={cn(DBODY_CLASS, 'text-ink')}>{guided.body}</span>
            <span className={cn(DCITE_CLASS, 'text-ink')}>{guided.cite}</span>
          </button>

          {/* BLANK — the escape hatch: dashed empty door on paper. */}
          <button
            type="button"
            onClick={onBlank}
            className={cn(
              DOOR_CLASS,
              'border-[3px] border-dashed border-ink/55 bg-paper text-ink shadow-[0_14px_26px_-14px_rgba(0,0,0,0.4)]'
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
            /mechs/patterns flow). */}
        {kind === 'mech' && (
          <AppLink
            href="/mechs/patterns"
            className="mx-auto mt-6 block w-fit max-w-[92%] rounded-[2px] bg-ink px-4 py-2 text-center font-cond text-[11px] font-bold uppercase leading-relaxed tracking-[0.1em] text-su-white no-underline hover:bg-ink/85"
          >
            A third door in the Blank family —{' '}
            <span className="text-su-orange">Instantiate from Pattern</span> · stamp a saved
            pattern, then edit freely
          </AppLink>
        )}
      </div>
    </section>
  )
}
