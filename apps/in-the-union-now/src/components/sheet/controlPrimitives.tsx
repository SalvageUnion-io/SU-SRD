/**
 * controlPrimitives — the shared scaffolding every sheet control repeated by
 * hand (audit item 24): the focus-ring input classes, the warn advisory box
 * (13 copies), the damage-intake row (TakeDamage/PilotTakeDamage twins), the
 * amount-input state cluster, and the freshest-record read.
 *
 * These are layout/state primitives only — no rules math lives here (that
 * stays in lib/rules per ADR-006) and nothing mutates the store.
 */

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Btn } from 'suref-react'

import { cn } from '../../lib/utils'
import type { DamageKind } from '../../lib/rules/takeDamage'
import type { EntityForType, EntityType } from '../../stores/types'

/** Numeric/text input chrome shared by the sheet controls (w-16 variant). */

const CONTROL_INPUT_CLASS =
  'w-16 rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

/** Full-width select/input chrome (SalvageControl pickers). */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export const CONTROL_SELECT_CLASS =
  'w-full rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

/**
 * The freshest record for a control action: rapid actions (or another tab's
 * write landing between renders) must not stomp each other, so handlers
 * re-read from the store and fall back to the render prop.
 */
type FreshEntityLookup = {
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null
}

// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function freshEntity<T extends EntityType>(
  storeState: FreshEntityLookup,
  type: T,
  fallback: EntityForType<T>
): EntityForType<T> {
  return storeState.get(type, fallback.id) ?? fallback
}

/** Damage-amount input state: text, parsed value, and validity. */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function useDamageAmount() {
  const [amountText, setAmountText] = useState('')
  const amount = Number.parseInt(amountText, 10)
  const amountValid = Number.isInteger(amount) && amount > 0
  return { amountText, setAmountText, amount, amountValid }
}

/** sessionStorage key prefix for the last-used damage kind (per entity type). */
const DAMAGE_KIND_STORAGE_PREFIX = 'itun-damage:lastKind:'

function readStickyKind(storageKey: string, fallback: DamageKind): DamageKind {
  if (typeof sessionStorage === 'undefined') return fallback
  const raw = sessionStorage.getItem(storageKey)
  return raw === 'sp' || raw === 'hp' ? raw : fallback
}

/**
 * Damage-kind toggle state that remembers the last pick for the session
 * (sessionStorage, per entity type — mirrors wizardDraft's session scoping).
 * The rules-correct kind is usually the same hit after hit, so defaulting to
 * it removes a tap without hiding the toggle. Dies with the tab.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: shared control helpers, colocated by design (audit items 24/19)
export function useStickyDamageKind(
  type: 'mech' | 'pilot',
  fallback: DamageKind
): readonly [DamageKind, (next: DamageKind) => void] {
  const storageKey = `${DAMAGE_KIND_STORAGE_PREFIX}${type}`
  const [kind, setKindState] = useState<DamageKind>(() => readStickyKind(storageKey, fallback))
  const setKind = useCallback(
    (next: DamageKind) => {
      setKindState(next)
      try {
        sessionStorage.setItem(storageKey, next)
      } catch {
        // sessionStorage unavailable/full — stickiness degrades gracefully.
      }
    },
    [storageKey]
  )
  return [kind, setKind] as const
}

type AdvisoryBoxProps = {
  /** Margin/layout tweaks per call site (e.g. 'mt-2'). */
  className?: string
  children: ReactNode
}

/**
 * The standard warn advisory: role="alert", warn border, paper box. Rich
 * content (buttons, multiple paragraphs) goes in as children; single-message
 * sites use <AdvisoryText> for the standard rust body copy.
 */
export function AdvisoryBox({ className, children }: AdvisoryBoxProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2', className)}
    >
      {children}
    </div>
  )
}

/** Single-message advisory — the box with the standard rust body text. */
export function AdvisoryText({ className, children }: AdvisoryBoxProps) {
  return (
    <AdvisoryBox className={className}>
      <p className="m-0 font-body text-sm text-rust">{children}</p>
    </AdvisoryBox>
  )
}

export type DamageKindOption = {
  kind: DamageKind
  /** Button label, e.g. 'SP damage' / 'HP damage (½)'. */
  label: string
  /** Tooltip explaining the conversion rule. */
  title: string
}

type DamageIntakeRowProps = {
  amountText: string
  onAmountChange: (text: string) => void
  /** Exactly the two listed-damage kinds, in display order. */
  kindOptions: readonly [DamageKindOption, DamageKindOption]
  kind: DamageKind
  onKindChange: (kind: DamageKind) => void
  vulnerable: boolean
  onVulnerableChange: (checked: boolean) => void
  applyDisabled: boolean
  onApply: () => void
}

/**
 * The take-damage intake row: amount input, listed-damage kind toggle,
 * Vulnerable ×2 checkbox, Apply. Shared verbatim by the mech and pilot
 * take-damage controls — only labels/rules differ, injected via props.
 */
export function DamageIntakeRow({
  amountText,
  onAmountChange,
  kindOptions,
  kind,
  onKindChange,
  vulnerable,
  onVulnerableChange,
  applyDisabled,
  onApply,
}: DamageIntakeRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={1}
        value={amountText}
        aria-label="Damage amount"
        placeholder="0"
        onChange={(e) => onAmountChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter applies the hit — the routine path shouldn't need a reach to
          // the Apply button after typing the amount.
          if (e.key === 'Enter' && !applyDisabled) {
            e.preventDefault()
            onApply()
          }
        }}
        className={CONTROL_INPUT_CLASS}
      />
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would need a legend and carries min-content sizing quirks in this inline-flex segment; role="group" + aria-label conveys the same semantics */}
      <span role="group" aria-label="Weapon damage type" className="inline-flex gap-1">
        {kindOptions.map((option) => (
          <Btn
            key={option.kind}
            size="sm"
            variant={kind === option.kind ? 'primary' : undefined}
            aria-pressed={kind === option.kind}
            title={option.title}
            onClick={() => onKindChange(option.kind)}
          >
            {option.label}
          </Btn>
        ))}
      </span>
      <label className="flex items-center gap-1.5 font-cond text-xs font-bold uppercase text-wk-muted">
        <input
          type="checkbox"
          checked={vulnerable}
          aria-label="Vulnerable — takes double damage"
          onChange={(e) => onVulnerableChange(e.target.checked)}
          className="accent-rust"
        />
        Vulnerable ×2
      </label>
      <Btn
        size="sm"
        variant="primary"
        disabled={applyDisabled}
        aria-label="Apply damage"
        onClick={onApply}
        // 44px touch target on mobile (app-wide pattern); back to compact on
        // pointer-precise viewports.
        className="min-h-11 px-4 sm:min-h-9"
      >
        Apply
      </Btn>
    </div>
  )
}
