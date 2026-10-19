import { Search } from 'lucide-react'
import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, iconSize, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { FOCUS_WITHIN } from './interaction'

/**
 * SearchField — the shared search box (canonical; hoisted from the SRD search
 * islands). A bordered, mono, paper-ground field with a leading
 * magnifier glyph; the container carries the keyboard-focus ring via
 * `focus-within` so the inner input can stay `focus:outline-none`.
 *
 * Purely presentational: it forwards `ref` and every extra prop straight to the
 * `<input>`, so a caller can wire it as a plain text input (a listing's name filter)
 * or as an ARIA combobox (the header dropdown) without this component knowing
 * which. The default look is the header's compact search; override
 * padding/size via `containerClassName` and width/etc. via `className`.
 */

type SearchFieldProps = ComponentPropsWithRef<'input'> & {
  /** Overrides merged onto the bordered container (e.g. taller padding, larger text). */
  containerClassName?: string
  /** The field's Size, which its magnifier takes (`iconSize`): Compact, or Full on a page's search. */
  glyph?: keyof typeof iconSize
  /**
   * The keyboard shortcut that focuses the field, shown as a key cap at its
   * end (`⌘K` — the Union bar's search slot reads the same in both tools).
   * Decorative: the shortcut is the caller's to wire and announce.
   */
  shortcut?: string
}

const GLYPH = { flexShrink: 0, opacity: 0.6 } satisfies CSSProperties

const SHORTCUT = { flexShrink: 0 } satisfies CSSProperties

const KEY_CAP = {
  borderColor: color.ink30,
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.badge,
  lineHeight: 1,
  paddingBlock: space[2],
  paddingInline: space[6],
} satisfies CSSProperties

export function SearchField({
  containerClassName,
  glyph = 'compact',
  shortcut,
  className,
  ref,
  ...inputProps
}: SearchFieldProps) {
  return (
    <div className={cn('su-search-field', FOCUS_WITHIN, containerClassName)}>
      <Search size={iconSize[glyph]} aria-hidden="true" style={GLYPH} />
      <input
        ref={ref}
        // The 16px font size is REQUIRED, not a style choice, and it must sit
        // on the input rather than the container. iOS Safari zooms the page
        // whenever a focused form control renders below 16px — so the
        // container's caption size, which the input would otherwise inherit,
        // made every tap on search yank the viewport. Measured at 390px
        // against the built output: 13px inherited here before this.
        //
        // Only the input is raised. The container stays at the caption size so
        // the glyph and the field's own metrics are unchanged, which keeps the
        // header search the same size it has always been.
        className={cn('su-search-field__input', className)}
        {...inputProps}
      />
      {shortcut && (
        <span aria-hidden="true" style={SHORTCUT}>
          <kbd style={KEY_CAP}>{shortcut}</kbd>
        </span>
      )}
    </div>
  )
}
