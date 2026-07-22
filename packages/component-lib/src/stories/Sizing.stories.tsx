import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Caption } from './_harness'
import { Badge } from '../components/chrome/Badge'
import { Text } from '../components/base/Text'
import { DEFAULT_RUNG, RUNG_INLINE_PADDING, RUNG_TYPE, type SizeRung } from '../styles/sizing'

export default {
  title: 'Foundations/Sizing',
}

/** Ladder order, largest first — specimen iteration only (the catalog page). */
const SIZE_RUNGS: readonly SizeRung[] = ['full', 'compact', 'mini']

/** What each rung is FOR — the rule, not the pixel count. */
const INTENT: Record<SizeRung, { line: string; use: string }> = {
  full: {
    line: 'The reading size.',
    use: 'A surface the user is looking at — a sheet header, a primary action, the card the page is about.',
  },
  compact: {
    line: 'The default.',
    use: 'A surface the user is scanning past — a listing row, a section label, a secondary control.',
  },
  mini: {
    line: 'The annotation size.',
    use: 'Attached to another element and never read alone — a count, a tech-level tag, a stamp riding a frame.',
  },
}

/** Real game terms — a specimen must never be lorem. */
const chassis = SalvageUnionReference.Chassis.all()[0]

function Rung({ rung }: { rung: SizeRung }) {
  const intent = INTENT[rung]
  return (
    <section className="border-chrome border-ink/15 border-t pt-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge shape="stamp" size={rung}>
          {rung}
        </Badge>
        <span className="font-body text-caption font-bold text-ink">{intent.line}</span>
        {rung === DEFAULT_RUNG && (
          <Badge shape="stamp" size="mini" surface="inverse">
            default
          </Badge>
        )}
      </header>

      <p className="mb-4 max-w-prose font-body text-caption text-wk-muted">{intent.use}</p>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <Caption>label · {RUNG_TYPE[rung].label}</Caption>
          {/* The stamp reads its geometry from the ladder, so this specimen
              cannot drift from the token the way a hand-set example would. */}
          <Badge shape="stamp" size={rung}>
            {chassis?.name ?? 'Mule'}
          </Badge>
          <p className="font-body text-note text-wk-faint">
            {RUNG_INLINE_PADDING[rung]} · {RUNG_TYPE[rung].label}
          </p>
        </div>

        <div className="space-y-2">
          <Caption>body · {RUNG_TYPE[rung].body}</Caption>
          <Text variant="body" className={RUNG_TYPE[rung].body}>
            Structure Points are restored during Downtime at the Union Crawler.
          </Text>
        </div>
      </div>
    </section>
  )
}

/**
 * The FULL / COMPACT / MINI ladder — one size vocabulary for the whole system.
 *
 * Size axes used to be named relative to their own component (`sm | md | lg` on
 * a stamp, `xs | sm | md | lg` on a button), so a name told you nothing about
 * which rung a surface belonged to and two components' `sm` were unrelated.
 * These three names are defined by INTENT, so they mean the same thing wherever
 * they are read.
 *
 * Every specimen below is rendered from `src/styles/sizing.ts` — the same
 * constants the components consume — so the catalog cannot drift from the code.
 */
export const Default: Story = () => (
  <div className="max-w-3xl space-y-6">
    <div>
      <h2 className="mb-1 font-cond text-lede font-bold uppercase tracking-caps text-ink">
        The size ladder
      </h2>
      <p className="max-w-prose font-body text-caption text-wk-muted">
        Three rungs, named for what they are for. A component offers the rungs it genuinely has and
        names them from this list — a two-rung component with{' '}
        <code className="font-mono text-note">compact</code> and{' '}
        <code className="font-mono text-note">mini</code> is correct and complete. Scan-past
        elements rest at <code className="font-mono text-note">compact</code>; a component whose
        resting anatomy is a destination readout (the poster gauge, the reading callout) rests at{' '}
        <code className="font-mono text-note">full</code>.
      </p>
    </div>

    {SIZE_RUNGS.map((rung) => (
      <Rung key={rung} rung={rung} />
    ))}
  </div>
)

/**
 * Label and body do NOT move together — a compact row can carry mini labels
 * over body-size text, which is why the ladder defines the two separately.
 */
export const LabelVersusBody: Story = () => (
  <div className="max-w-3xl space-y-3">
    <Caption>each rung's label size beside its body size</Caption>
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          {['rung', 'label', 'body', 'inline padding'].map((h) => (
            <th
              key={h}
              className="border-ink/15 border-b px-2 py-1.5 font-cond text-micro font-bold uppercase tracking-caps-wide text-wk-muted"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SIZE_RUNGS.map((rung) => (
          <tr key={rung}>
            <td className="border-ink/10 border-b px-2 py-2">
              <Badge shape="stamp" size={rung}>
                {rung}
              </Badge>
            </td>
            <td className="border-ink/10 border-b px-2 py-2">
              <span className={`font-cond font-bold uppercase ${RUNG_TYPE[rung].label} text-ink`}>
                Salvage Union
              </span>
            </td>
            <td className="border-ink/10 border-b px-2 py-2">
              <span className={`font-body ${RUNG_TYPE[rung].body} text-ink`}>Salvage Union</span>
            </td>
            <td className="border-ink/10 border-b px-2 py-2 font-mono text-note text-wk-muted">
              {RUNG_INLINE_PADDING[rung]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
