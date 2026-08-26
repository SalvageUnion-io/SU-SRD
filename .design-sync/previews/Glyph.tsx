/* Ported from packages/component-lib/src/components/chrome/Glyph.stories.tsx. */
import { Glyph } from 'component-lib'
import { Group } from '../preview-lib/harness'

/** Filled geometry — the original set. */
const FILLED = ['gear', 'clock', 'pennant', 'x'] as const
/** Stroked geometry — the live-sheet edit-language affordances. */
const STROKED = ['pencil', 'check', 'plus', 'remove', 'swap'] as const

/**
 * The whole set. It carries BOTH filled icons and stroked control affordances;
 * `Glyph` picks the right rendering per name, so a caller never has to know
 * which is which.
 */
export function AllGlyphs() {
  return (
    <div className="space-y-5 bg-paper p-4">
      <Group caption="filled · currentColor at 1em">
        <div className="flex items-center gap-6 text-ink">
          {FILLED.map((name) => (
            <span key={name} className="flex items-center gap-2 text-2xl">
              <Glyph name={name} />
              <span className="font-cond text-xs uppercase tracking-caps-tight">{name}</span>
            </span>
          ))}
        </div>
      </Group>
      <Group caption="stroked · the edit-language affordances">
        <div className="flex items-center gap-6 text-ink">
          {STROKED.map((name) => (
            <span key={name} className="flex items-center gap-2 text-2xl">
              <Glyph name={name} />
              <span className="font-cond text-xs uppercase tracking-caps-tight">{name}</span>
            </span>
          ))}
        </div>
      </Group>
    </div>
  )
}

/** `currentColor` and 1em sizing — a glyph takes both from its context. */
export function ColorAndSize() {
  return (
    <div className="space-y-4 bg-paper p-4">
      <Group caption="currentColor · inherits ink / rust from context">
        <div className="flex items-center gap-2 text-ink">
          <Glyph name="gear" />
          <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
            Turn Action · ink
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-rust">
          <Glyph name="pennant" />
          <span className="font-cond text-sm font-bold uppercase tracking-caps-tight">
            1 AP · rust = action
          </span>
        </div>
      </Group>
      <Group caption="1em · scales with the font-size of its container">
        <div className="flex items-end gap-4 text-ink">
          <span className="text-sm">
            <Glyph name="clock" />
          </span>
          <span className="text-xl">
            <Glyph name="clock" />
          </span>
          <span className="text-3xl">
            <Glyph name="clock" />
          </span>
          <span className="text-5xl">
            <Glyph name="clock" />
          </span>
        </div>
      </Group>
      <Group caption="title · a non-decorative glyph exposes an img role + label">
        <div className="text-2xl text-ink">
          <Glyph name="pennant" title="1 Action Point" />
        </div>
      </Group>
    </div>
  )
}
