import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { parseContentBlockString } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Text } from '../../base/Text'
import { Slab } from '../../chrome/Slab'
import { Stamp } from '../../chrome/Stamp'
import {
  type ChoiceSelections,
  getChoiceCardOptions,
  isFreeTextChoice,
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
} from '../choiceCard/choiceSelectionHelpers'
import { accentDeepColor } from '../referenceEntityHelpers'

/**
 * NEWChoiceGroups — the write-layer choice renderer in the NEW design language.
 *
 * A choice is just another nested group: a dashed `Slab` (the choice name) over a
 * masonry of compact option cards, in the SAME chrome as any nested card — a tone
 * band with a black name-tab (the option label) + a paper description body. The
 * selection layer is the exact write-layer idiom: dim-until-chosen (editable) and
 * the canonical rust `SELECTION_RING` when chosen. Read-only shows every option
 * full and static (the choices are readable; they just aren't choosable).
 *
 * A drop-in for the legacy `ChoiceGroups` — it reuses the identical selection
 * state machinery (controlled / ephemeral, id-keyed, cap resolution) so ITUN
 * persistence and the SRD ephemeral case both keep working unchanged.
 */

type NEWChoiceGroupsProps = {
  choices: SURefObjectChoice[]
  /** Parent entity — resolves `scalesWithField` caps (e.g. techLevel). */
  parent?: Record<string, unknown>
  /** Controlled selections (id-keyed). With `onSelectionChange` → controlled. */
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Static (readable, not choosable) — the SRD reference / snapshots. */
  readOnly?: boolean
  compact?: boolean
  /** Parent tone as a raw CSS colour — the option-card band + Slab/frame colour. */
  toneColor?: string
}

/** A selectable OPTION card — the NEW compact-card chrome (tone band + black
 *  name-tab + paper body), dim-until-chosen with the rust ring when chosen. */
function NEWChoiceOption({
  label,
  description,
  chosen,
  readOnly,
  onToggle,
  toneColor,
  compact,
}: {
  label: string
  description?: string
  chosen: boolean
  readOnly?: boolean
  onToggle: () => void
  toneColor?: string
  compact?: boolean
}): ReactNode {
  const parsedDescription = useParseTraitReferences(description ?? '')
  // ONE consistent tone (the parent entity's), conveying state purely by DIM →
  // UNDIM: an unchosen option is dimmed (like an action's dimmer version) with no
  // stamp; the chosen option un-dims to full strength and gains a "Chosen"
  // stampseal riding its top border. No selection ring.
  const frameColor = accentDeepColor(undefined, toneColor) ?? 'var(--color-ink)'
  const card = (
    <div className="relative">
      {chosen && (
        <Stamp seam size="sm" className="right-2">
          Chosen
        </Stamp>
      )}
      <div className="overflow-hidden rounded-card" style={{ border: `3px solid ${frameColor}` }}>
        <div
          className={cn('flex items-center', compact ? 'px-2 py-1' : 'px-2.5 py-1.5')}
          style={{ backgroundColor: toneColor }}
        >
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'w-fit font-cond font-bold uppercase leading-none tracking-caps-tight',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {label}
          </Text>
        </div>
        {description && (
          <div
            className={cn(
              'bg-paper leading-snug text-ink',
              compact ? 'px-2.5 py-1.5 text-label' : 'px-3 py-2 text-xs'
            )}
          >
            {parsedDescription}
          </div>
        )}
      </div>
    </div>
  )
  // Always a `button[aria-pressed]` so the chosen state stays queryable in BOTH
  // modes (the read-only snapshot / share-link viewer needs to see which option
  // was chosen). Read-only just makes it inert — no toggle handler, default
  // cursor — while keeping the same dim-until-chosen visual.
  const wrap = cn('block rounded-card transition-opacity duration-150', !chosen && 'opacity-45')
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={readOnly ? undefined : onToggle}
      className={cn('w-full text-left', wrap, readOnly && 'cursor-default')}
    >
      {card}
    </button>
  )
}

/** One choice group: a dashed Slab (name + optional n/max) over the option cards,
 *  or a single NEW-chrome input card for a free-text choice (Name / Motto / …). */
function NEWChoiceGroup({
  choice,
  selected,
  cap,
  onToggleOption,
  onFreeTextChange,
  readOnly,
  compact,
  toneColor,
}: {
  choice: SURefObjectChoice
  selected: string[]
  cap?: number
  onToggleOption: (value: string) => void
  onFreeTextChange: (value: string) => void
  readOnly?: boolean
  compact?: boolean
  toneColor?: string
}): ReactNode {
  const frameColor = accentDeepColor(undefined, toneColor) ?? 'var(--color-ink)'
  // Colour the dashed Slab with the parent tone (it reads `--tone-deep`).
  const toneVar = { '--tone-deep': toneColor } as CSSProperties

  if (isFreeTextChoice(choice)) {
    const promptBlock = choice.content?.find((b) => b.type === 'paragraph')
    const description = promptBlock ? parseContentBlockString(promptBlock) : undefined
    const value = selected[0] ?? ''
    const multiline = choice.name.toLowerCase() !== 'name'
    return (
      <div style={toneVar}>
        <Slab variant="dashed" label={choice.name} />
        <div className="overflow-hidden rounded-card" style={{ border: `3px solid ${frameColor}` }}>
          <div
            className={cn('flex items-center', compact ? 'px-2 py-1' : 'px-2.5 py-1.5')}
            style={{ backgroundColor: toneColor }}
          >
            <Text
              variant="pseudoheader"
              as="span"
              className={cn(
                'w-fit font-cond font-bold uppercase leading-none tracking-caps-tight',
                compact ? 'text-xs' : 'text-sm'
              )}
            >
              {choice.name}
            </Text>
          </div>
          <div className="bg-paper px-3 py-2">
            {readOnly ? (
              <p className="font-body text-xs text-ink">{value || description || '—'}</p>
            ) : multiline ? (
              <textarea
                className="w-full rounded border border-ink/20 bg-paper p-1.5 font-body text-xs text-ink focus:border-rust focus:outline-none"
                rows={2}
                value={value}
                placeholder={description}
                onChange={(e) => onFreeTextChange(e.target.value)}
              />
            ) : (
              <input
                className="w-full rounded border border-ink/20 bg-paper p-1.5 font-body text-xs text-ink focus:border-rust focus:outline-none"
                value={value}
                placeholder={description}
                onChange={(e) => onFreeTextChange(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  const multi = isMultiSelectChoice(choice)
  const counter = multi && typeof cap === 'number' ? `${selected.length}/${cap}` : undefined
  const options = getChoiceCardOptions(choice)
  return (
    <div style={toneVar}>
      <Slab variant="dashed" label={choice.name} count={counter} />
      <div className={cn('gap-1.5', compact ? 'columns-1' : 'columns-1 sm:columns-2')}>
        {options.map((option) => (
          <div key={option.value} className="mb-1.5 break-inside-avoid pt-2.5">
            <NEWChoiceOption
              label={option.label}
              description={option.description}
              chosen={selected.includes(option.value)}
              readOnly={readOnly}
              onToggle={() => onToggleOption(option.value)}
              toneColor={toneColor}
              compact={compact}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function NEWChoiceGroups({
  choices,
  parent,
  selections: controlled,
  onSelectionChange,
  readOnly,
  compact,
  toneColor,
}: NEWChoiceGroupsProps) {
  const isControlled = controlled !== undefined
  const [internal, setInternal] = useState<ChoiceSelections>({})
  const selections = isControlled ? controlled : internal

  const commit = useCallback(
    (next: ChoiceSelections) => {
      if (!isControlled) setInternal(next)
      onSelectionChange?.(next)
    },
    [isControlled, onSelectionChange]
  )
  const toggleOption = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      const current = selections[choice.id] ?? []
      commit({
        ...selections,
        [choice.id]: toggleSelection(current, value, isMultiSelectChoice(choice)),
      })
    },
    [selections, commit]
  )
  const freeTextChange = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      commit({ ...selections, [choice.id]: value.length > 0 ? [value] : [] })
    },
    [selections, commit]
  )

  if (choices.length === 0) return null
  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {choices.map((choice) => (
        <NEWChoiceGroup
          key={choice.id}
          choice={choice}
          selected={selections[choice.id] ?? []}
          cap={resolveMultiSelectCap(choice, parent)}
          onToggleOption={(value) => toggleOption(choice, value)}
          onFreeTextChange={(value) => freeTextChange(choice, value)}
          readOnly={readOnly}
          compact={compact}
          toneColor={toneColor}
        />
      ))}
    </div>
  )
}
