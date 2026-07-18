/**
 * Legacy "before" capture — ITUN Dashboard `DashboardChooser` (launch wizard).
 *
 * Reproduces the chooser's presentational shell from
 * apps/in-the-union-now/src/components/dashboard/DashboardChooser.tsx VERBATIM —
 * the `bg-paper p-5` wizard body and the inlined `ChooserList` radio grammar
 * (raw `border-chrome border-ink bg-paper … accent-rust` rows), plus the
 * Back/Next/Launch nav built from component-lib's `Btn`. Unlike the pc-* dashboard
 * instruments this component is Tailwind-on-paper and already leans on canonical
 * atoms, so there is no co-located CSS slice; the enclosing `ModalShell` chrome
 * is canonical and captured elsewhere, so the body is rendered directly on the
 * paper canvas. Rows are driven from real `SalvageUnionReference.Chassis` (mech
 * step) and the app's real default-base-crawler tokens (crawler step). L1
 * reconciliation: freeze the "before", do not refactor the raw markup.
 */

import type { Story } from '@ladle/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn } from '../../components/chrome/Btn'
import { Caption } from '../_harness'

// --- Verbatim reproduction of DashboardChooser's inlined ChooserList (radio) ---
type ChooserOption = { id: string; label: string; sublabel?: string }

function ChooserList({
  name,
  options,
  emptyMessage,
  selectedId,
  onSelect,
  includeNone = false,
}: {
  name: string
  options: ChooserOption[]
  emptyMessage: string
  selectedId: string
  onSelect: (id: string) => void
  includeNone?: boolean
}) {
  if (options.length === 0 && !includeNone) {
    return <p className="font-body text-sm text-wk-muted">{emptyMessage}</p>
  }
  const rows: ChooserOption[] = includeNone ? [{ id: '', label: 'None' }, ...options] : options
  return (
    <div className="space-y-2">
      {options.length === 0 && <p className="font-body text-sm text-wk-muted">{emptyMessage}</p>}
      {rows.map((option) => (
        <label
          key={option.id || '__none__'}
          className="flex cursor-pointer items-center gap-2 rounded-[3px] border-chrome border-ink bg-paper p-2 hover:bg-wk-bg-2"
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={selectedId === option.id}
            onChange={() => onSelect(option.id)}
            className="accent-rust"
          />
          <span className="font-body text-sm font-medium text-ink">{option.label}</span>
          {option.sublabel && (
            <span className="font-body text-xs text-wk-muted">{option.sublabel}</span>
          )}
        </label>
      ))}
    </div>
  )
}

/** Chassis "TL n" annotation for a mech row (mirrors chassisMeta, best-effort). */
function chassisRows(): ChooserOption[] {
  const all = SalvageUnionReference.Chassis.all() as ReadonlyArray<{
    name: string
    techLevel?: number
  }>
  return all.slice(0, 5).map((c) => ({
    id: c.name,
    label: c.name,
    sublabel: c.techLevel != null ? `${c.name} · TL ${c.techLevel}` : c.name,
  }))
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard Chooser' }

/** The wizard body (verbatim `bg-paper p-5` container) around a single step. */
function ChooserBody({
  subtitle,
  children,
  primaryLabel,
  error,
}: {
  subtitle: string
  children: ReactNode
  primaryLabel: string
  error?: string
}) {
  return (
    <div style={{ maxWidth: 420 }}>
      {/* ModalShell header context (the shell itself is canonical, captured elsewhere). */}
      <div className="mb-2 font-cond text-label uppercase tracking-caps text-wk-muted">
        Launch Dashboard · {subtitle}
      </div>
      <div className="flex flex-col gap-4 border-chrome border-ink bg-paper p-5">
        {children}
        {error && (
          <p className="font-body text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-between gap-2">
          <Btn variant="ghost" size="sm">
            Back
          </Btn>
          <Btn variant="primary" size="sm">
            {primaryLabel}
          </Btn>
        </div>
      </div>
    </div>
  )
}

export const MechStep: Story = () => {
  const [mechId, setMechId] = useState('')
  return (
    <div>
      <Caption>
        DashboardChooser · mech step — the inlined ChooserList radio grammar (raw
        border-chrome/accent-rust rows) driven by real SalvageUnionReference Chassis, with the Back
        / Next nav built from the canonical Btn atom.
      </Caption>
      <ChooserBody subtitle="Step 2 of 3 · Choose a mech" primaryLabel="Next">
        <ChooserList
          name="dashboard-mech"
          emptyMessage="No mechs or patterns yet. Create a mech or save a pattern first."
          selectedId={mechId}
          onSelect={setMechId}
          options={chassisRows()}
        />
      </ChooserBody>
    </div>
  )
}

export const CrawlerStep: Story = () => {
  const [crawlerId, setCrawlerId] = useState('')
  // The app's real default-base-crawler tokens (DEFAULT_CRAWLER_TLS → tl:n).
  const options: ChooserOption[] = [1, 2, 3].map((tl) => ({
    id: `tl:${tl}`,
    label: 'Default base crawler',
    sublabel: `New · TL ${tl}`,
  }))
  return (
    <div>
      <Caption>
        DashboardChooser · crawler step (optional) — the includeNone leading "None" radio plus the
        app's real default-base-crawler token rows, and the Launch primary action.
      </Caption>
      <ChooserBody subtitle="Step 3 of 3 · Choose a crawler" primaryLabel="Launch">
        <p className="font-body text-xs text-wk-muted">
          Optional — launch on foot / in the mech without a crawler, or anchor to one.
        </p>
        <ChooserList
          name="dashboard-crawler"
          emptyMessage="No crawlers yet — pick a default base crawler or launch without one."
          selectedId={crawlerId}
          onSelect={setCrawlerId}
          includeNone
          options={options}
        />
      </ChooserBody>
    </div>
  )
}
