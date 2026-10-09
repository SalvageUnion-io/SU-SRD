import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import { createContext, useContext, useId, useLayoutEffect, useMemo, useState } from 'react'

/**
 * Exactly-one pickers whose options are CARDS — an entity card, a `Sel` ring —
 * on Base UI's RadioGroup, which gives them the radio pattern: one tab stop
 * (the checked card), arrow keys moving between cards and checking the one
 * they land on, Space checking the focused one.
 *
 * Each card keeps its own select callback and its own `selected`, as every
 * picker already passes them: a press calls the callback directly (so a picker
 * whose second press clears its pick still can), and an arrow key reaches it
 * through the group, which looks the landed-on card's callback up by value.
 */

type Registry = {
  /** Each mounted card's select callback, by its radio value. */
  selects: Map<string, () => void>
  setChecked: Dispatch<SetStateAction<string | null>>
}

const RadioCardContext = createContext<Registry | null>(null)

type RadioCardGroupProps = {
  /** Names the group. */
  label: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** The `role="radiogroup"` around a picker's `RadioCard`s, at any depth. */
export function RadioCardGroup({ label, className, style, children }: RadioCardGroupProps) {
  const [checked, setChecked] = useState<string | null>(null)
  const [selects] = useState(() => new Map<string, () => void>())
  const registry = useMemo(() => ({ selects, setChecked }), [selects])
  return (
    <RadioCardContext.Provider value={registry}>
      <RadioGroup<string | null>
        aria-label={label}
        value={checked}
        onValueChange={(value) => {
          if (value !== null) selects.get(value)?.()
        }}
        className={className}
        style={style}
      >
        {children}
      </RadioGroup>
    </RadioCardContext.Provider>
  )
}

type RadioCardProps = {
  selected: boolean
  onSelect: () => void
  className?: string
  style?: CSSProperties
  'aria-label'?: string
  children: ReactNode
}

/**
 * One card in a `RadioCardGroup`: a `<div role="radio">` with `aria-checked`
 * from `selected`. Outside a group it is still a radio, without the arrow keys.
 */
export function RadioCard({
  selected,
  onSelect,
  className,
  style,
  'aria-label': ariaLabel,
  children,
}: RadioCardProps) {
  const value = useId()
  const group = useContext(RadioCardContext)

  useLayoutEffect(() => {
    if (!group) return
    group.selects.set(value, onSelect)
    return () => {
      group.selects.delete(value)
    }
  }, [group, value, onSelect])

  // The group's checked value follows the cards' `selected`, so its tab stop
  // is the selected card.
  useLayoutEffect(() => {
    if (!group || !selected) return
    group.setChecked(value)
    return () => group.setChecked((current) => (current === value ? null : current))
  }, [group, value, selected])

  return (
    <Radio.Root
      value={value}
      aria-checked={selected}
      aria-label={ariaLabel}
      className={className}
      style={style}
      render={<div />}
      onClick={(event) => {
        // The press is the card's own: skip Base UI's, which would check the
        // radio through the group a second time.
        event.preventBaseUIHandler()
        onSelect()
      }}
    >
      {children}
    </Radio.Root>
  )
}
