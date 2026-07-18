import type { Story } from '@ladle/react'
import { type ReactNode, useState } from 'react'
import { Btn } from '../../../components/chrome/Btn'
import { cn } from '../../../utils/cn'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mech Flavor Step' }

/**
 * Local mirror of the presentational shell of ITUN's sheet IdentityField
 * (apps/in-the-union-now/src/components/sheet/IdentityField.tsx lines 80-165),
 * in its EDITING branch — the label tab + solid tone-deep value box + pinned pen
 * icon. APPROXIMATION: the real box wraps InlineEditField / InlineEditTextArea
 * (app-only click-to-edit inputs); those are stood in here by a plain
 * input/textarea so the shell renders self-contained. The visible chrome (label
 * tab, box border, pen) is reproduced verbatim.
 */
const EDIT_VALUE_BOX_CLASS =
  'relative flex min-h-[44px] items-center rounded-[8px] border-2 border-[color:var(--tone-deep,var(--color-ink))] bg-paper px-3 py-2 pr-9 font-body text-sm text-ink'

const PEN_CLASS =
  'pointer-events-none absolute right-[10px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55'

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

function LegacyIdentityField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder = '—',
  labelAction,
  className,
}: {
  label: string
  value: string
  onSave: (next: string) => void
  multiline?: boolean
  placeholder?: string
  labelAction?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {/* Label row — tight (~2px) above the value box (redesign refinement). */}
      <span className="mb-[2px] flex items-center justify-between gap-2">
        <span className="bg-ink px-1.5 pb-px pt-[2px] font-cond text-label font-bold uppercase leading-none tracking-caps text-paper">
          {label}
        </span>
        {labelAction}
      </span>
      <span className={EDIT_VALUE_BOX_CLASS}>
        {multiline ? (
          <textarea
            value={value}
            placeholder={placeholder}
            aria-label={`Edit ${label.toLowerCase()}`}
            onChange={(e) => onSave(e.target.value)}
            className="w-full resize-none border-0 bg-transparent font-body text-sm text-ink outline-none"
            rows={3}
          />
        ) : (
          <input
            value={value}
            placeholder={placeholder}
            aria-label={`Edit ${label.toLowerCase()}`}
            onChange={(e) => onSave(e.target.value)}
            className="w-full border-0 bg-transparent font-body text-sm text-ink outline-none"
          />
        )}
        <PenIcon className={PEN_CLASS} />
      </span>
    </div>
  )
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/mech/MechFlavorStep.tsx (lines 28-61):
 * an IdentityField (editing) with a d20 "Roll" Btn as its labelAction, plus an
 * optional helper note. APPROXIMATION: the roll assist wraps app-only
 * `rollForMechField` (mechRollTables.ts) — here the Roll button writes a
 * representative real game term so the assist path is visible without importing
 * app code.
 */
function LegacyMechFlavorStep({
  label,
  multiline = false,
  note,
  rollResult,
}: {
  label: string
  multiline?: boolean
  note?: string
  rollResult: string
}) {
  const [value, setValue] = useState('')

  return (
    <div className="max-w-3xl space-y-3">
      <LegacyIdentityField
        label={label}
        value={value}
        onSave={setValue}
        multiline={multiline}
        labelAction={
          <Btn size="sm" onClick={() => setValue(rollResult)} className="shrink-0">
            <span aria-hidden="true">⚄</span> Roll
          </Btn>
        }
      />
      {note && <p className="m-0 font-body text-caption text-current">{note}</p>}
    </div>
  )
}

export const PatternName: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Mech Flavor step, Pattern Name field (ITUN MechFlavorStep, lines 28-61)
    </Caption>
    <LegacyMechFlavorStep
      label="Pattern Name"
      note="A mech's name is its pattern — this is what it will be called."
      rollResult="Ravager"
    />
  </div>
)

export const Appearance: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Mech Flavor step, multiline Appearance field</Caption>
    <LegacyMechFlavorStep
      label="Appearance"
      multiline
      rollResult="A hulking scavenged frame, mismatched armour plates welded over a rust-red chassis."
    />
  </div>
)
