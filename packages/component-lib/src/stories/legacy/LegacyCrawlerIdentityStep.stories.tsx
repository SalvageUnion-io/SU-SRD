/**
 * Legacy "before" capture — ITUN crawler wizard `CrawlerIdentityStep`.
 *
 * Reproduces the presentational shell of
 * apps/in-the-union-now/src/components/crawler/CrawlerIdentityStep.tsx VERBATIM
 * (lines 33-105): two app-only `IdentityField`s (Crawler Name with a d20 Roll
 * assist, Description) over a `Scrap Pool` section of six `Field`/`Input` TL
 * buckets. Shared `Btn`/`Field`/`Input` atoms come from `component-lib`; the
 * app-only `IdentityField` (sheet/IdentityField.tsx) is mirrored locally
 * below — APPROXIMATION: its `InlineEditField`/`InlineEditTextArea` save-on-blur
 * editors are stood in by plain controlled `<input>`/`<textarea>` with the same
 * box chrome. The p.226 Crawler-Names roll is stood in by a fixed real name.
 * L1 reconciliation: freeze the "before".
 */

import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Btn, cn, Field, Input } from 'component-lib'
import { Caption } from '../_harness'

// --- Mirror of ITUN's app-only ScrapPoolForm (crawlerFormState.ts). ---
type ScrapPoolForm = {
  tl1: number
  tl2: number
  tl3: number
  tl4: number
  tl5: number
  tl6: number
}

const SCRAP_BUCKETS = ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6'] as const

function parseCount(raw: string): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

// --- Verbatim class strings from sheet/IdentityField.tsx (lines 48-78). ---
const READ_VALUE_BOX_CLASS =
  'flex min-h-[44px] items-center rounded-[8px] border-2 bg-paper px-3 py-2 font-body text-sm text-ink'
const EDIT_VALUE_BOX_CLASS =
  'relative flex min-h-[44px] items-center rounded-[8px] border-2 border-[color:var(--tone-deep,var(--color-ink))] bg-paper px-3 py-2 pr-9 font-body text-sm text-ink'
const EDIT_CUE_CLASS =
  'outline-dashed outline-2 outline-offset-2 outline-[color:var(--tone-deep,var(--color-rust))]'
const PEN_CLASS =
  'pointer-events-none absolute right-[10px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55'

/** Pen icon pinned right inside an editing box (verbatim, IdentityField.tsx:60-75). */
function PenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m16.5 3.5 4 4L7 21H3v-4z" />
    </svg>
  )
}

/**
 * Local mirror of sheet/IdentityField.tsx (the app-only labeled identity field:
 * a black label tab tight above the value box). APPROXIMATION: the editable
 * branch inlines a controlled input/textarea in place of the InlineEditField/
 * InlineEditTextArea save-on-blur editors — same box chrome, same pen icon.
 */
function IdentityField({
  label,
  value,
  editing = false,
  onSave,
  multiline = false,
  placeholder = '—',
  labelAction,
  ariaLabel,
  className,
}: {
  label: string
  value: string
  editing?: boolean
  onSave?: (next: string) => void
  multiline?: boolean
  placeholder?: string
  labelAction?: ReactNode
  ariaLabel?: string
  className?: string
}) {
  const fieldLabel = ariaLabel ?? label
  const isEditable = editing && onSave !== undefined

  let valueNode: ReactNode
  if (isEditable && onSave) {
    valueNode = (
      <span className={cn(EDIT_VALUE_BOX_CLASS, EDIT_CUE_CLASS)}>
        {multiline ? (
          <span className="w-full min-w-0">
            <textarea
              value={value}
              aria-label={`Edit ${fieldLabel.toLowerCase()}`}
              placeholder={placeholder}
              onChange={(e) => onSave(e.target.value)}
              className="w-full resize-none bg-transparent font-body text-sm font-normal text-ink outline-none"
              rows={2}
            />
          </span>
        ) : (
          <input
            value={value}
            aria-label={`Edit ${fieldLabel.toLowerCase()}`}
            placeholder={placeholder}
            onChange={(e) => onSave(e.target.value)}
            className="w-full bg-transparent text-left font-body text-sm font-normal text-ink outline-none"
          />
        )}
        <PenIcon className={PEN_CLASS} />
      </span>
    )
  } else {
    valueNode = (
      <span
        className={cn(READ_VALUE_BOX_CLASS, !value && 'text-wk-muted')}
        style={{
          borderColor: 'color-mix(in oklch, var(--tone-deep, var(--color-ink)) 50%, transparent)',
        }}
      >
        <span className={cn('min-w-0', multiline ? 'whitespace-pre-wrap' : 'truncate')}>
          {value || placeholder}
        </span>
      </span>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <span className="mb-[2px] flex items-center justify-between gap-2">
        <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-paper">
          {label}
        </span>
        {labelAction}
      </span>
      {valueNode}
    </div>
  )
}

// Verbatim reproduction of CrawlerIdentityStep.tsx (lines 33-105).
function CrawlerIdentityStep({
  name,
  description,
  scrapPool,
  onChange,
}: {
  name: string
  description: string
  scrapPool: ScrapPoolForm
  onChange: (patch: { name?: string; description?: string; scrapPool?: ScrapPoolForm }) => void
}) {
  function handleRoll() {
    // Stands in for rollCrawlerName (p.226 d20 Crawler Names Table).
    onChange({ name: 'Crawler #132, aka ‘Tin Lizzy’' })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <IdentityField
        label="Crawler Name"
        value={name}
        editing
        onSave={(next) => onChange({ name: next })}
        placeholder="e.g. Crawler #132, aka ‘Tin Lizzy’"
        labelAction={
          <Btn size="sm" onClick={handleRoll} className="shrink-0">
            <span aria-hidden="true">⚄</span> Roll
          </Btn>
        }
      />

      <IdentityField
        label="Description"
        value={description}
        editing
        multiline
        onSave={(next) => onChange({ description: next })}
        placeholder="What the crawler is, its build and history."
      />

      <section className="space-y-4 rounded-[3px] border-chrome border-wk-faint p-4">
        <header>
          <h2 className="m-0 font-cond text-sm font-bold uppercase tracking-widest text-ink">
            Scrap Pool
          </h2>
          <p className="mt-0.5 font-body text-xs text-wk-muted">
            The group&rsquo;s banked Scrap, bucketed by tech level — including whatever your Pilots
            didn&rsquo;t spend crafting their Mechs. Optional; leave at 0 for a fresh start.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {SCRAP_BUCKETS.map((bucket, i) => {
            const id = `crawler-scrap-${bucket}`
            return (
              <Field key={bucket} label={`Scrap T${i + 1}`} htmlFor={id}>
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={scrapPool[bucket]}
                  onChange={(e) =>
                    onChange({
                      scrapPool: {
                        ...scrapPool,
                        [bucket]: parseCount(e.target.value),
                      },
                    })
                  }
                />
              </Field>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Crawler Identity Step' }

export const Default: Story = () => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scrapPool, setScrapPool] = useState<ScrapPoolForm>({
    tl1: 0,
    tl2: 0,
    tl3: 0,
    tl4: 0,
    tl5: 0,
    tl6: 0,
  })

  return (
    <div>
      <Caption>
        CrawlerIdentityStep — IdentityField Name (with d20 Roll) + Description over the Scrap Pool
        buckets (CrawlerIdentityStep.tsx:33-105). IdentityField is mirrored locally.
      </Caption>
      <CrawlerIdentityStep
        name={name}
        description={description}
        scrapPool={scrapPool}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name)
          if (patch.description !== undefined) setDescription(patch.description)
          if (patch.scrapPool !== undefined) setScrapPool(patch.scrapPool)
        }}
      />
    </div>
  )
}
