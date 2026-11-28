/**
 * AutosavedText — an encounter's Notes or Briefing in Edit (r6 B2): a text
 * box that saves itself as it is typed (`useAutosavedText`), with the same
 * "Saved" sign the Game's notes in Prep wear. Read prints the text instead.
 */

import type { CSSProperties } from 'react'
import { useId } from 'react'
import { capsLabel, Field, Textarea } from '../../components/index'
import { playGamesCopy } from '../../messages/play-games'
import type { TextSaveState } from './useAutosavedText'
import { useAutosavedText } from './useAutosavedText'

const CAPS = capsLabel()
const SIGN = { margin: 0 } satisfies CSSProperties

/** A save sign's words, each key said outright so the catalogue sees it. */
function signWords(state: TextSaveState | null): string {
  if (state === null) return ''
  if (state === 'saving') return playGamesCopy('planSaving')
  return state === 'saved' ? playGamesCopy('planSaved') : playGamesCopy('planNotSaved')
}

export function AutosavedText({
  label,
  value,
  max,
  rows = 6,
  placeholder,
  onSave,
}: {
  label: string
  value: string
  max: number
  rows?: number
  placeholder?: string
  /** Keep the text; rejects when refused. */
  onSave: (text: string) => Promise<unknown>
}) {
  const id = useId()
  const text = useAutosavedText({ kept: value, save: (next) => onSave(next.slice(0, max)) })
  return (
    <>
      <Field label={label} htmlFor={id}>
        <Textarea
          id={id}
          rows={rows}
          value={text.value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => text.change(e.target.value)}
          onBlur={() => text.flush()}
        />
      </Field>
      <p role="status" className={CAPS} style={SIGN}>
        {signWords(text.state)}
      </p>
    </>
  )
}
