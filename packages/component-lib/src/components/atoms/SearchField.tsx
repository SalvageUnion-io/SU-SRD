import { Search } from 'lucide-react'
import type { ComponentPropsWithRef, CSSProperties } from 'react'
import { borderWidth, color, font, fontSize, radius, space } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { FOCUS_RING, FOCUS_WITHIN } from './interaction'

/**
 * SearchField — the shared search box (canonical; hoisted from the SRD search
 * islands). A bordered, mono, paper-ground field with a leading
 * magnifier glyph; the container carries the keyboard-focus ring via
 * `focus-within` so the inner input can stay `focus:outline-none`.
 *
 * Purely presentational: it forwards `ref` and every extra prop straight to the
 * `<input>`, so a caller can wire it as a plain text input (the `/search` page)
 * or as an ARIA combobox (the header dropdown) without this component knowing
 * which. The default look is the header's compact `.srd-search`; override
 * padding/size via `containerClassName` and width/etc. via `className`.
 */

type SearchFieldProps = ComponentPropsWithRef<'input'> & {
  /** Overrides merged onto the bordered container (e.g. taller padding, larger text). */
  containerClassName?: string
  /** Magnifier glyph size in px. */
  glyphSize?: number
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
  glyphSize = 14,
  shortcut,
  className,
  ref,
  ...inputProps
}: SearchFieldProps) {
  return (
    <div className={cn('su-search-field', FOCUS_WITHIN, containerClassName)}>
      <Search size={glyphSize} strokeWidth={2.5} aria-hidden="true" style={GLYPH} />
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

type SearchFieldTriggerProps = ComponentPropsWithRef<'button'> & {
  /** What the field would say empty: its placeholder, drawn as the label. */
  label: string
  /** Classes on the label, where `SearchField` takes them on its input (the bar's width). */
  labelClassName?: string
  /** The shortcut's key cap, as on `SearchField`. Decorative. */
  shortcut?: string
}

/**
 * SearchFieldTrigger — `SearchField`'s shape as a button, for a search that
 * opens elsewhere (The Cantina's popover) rather than in place (the SRD's combobox).
 * The Union bar's search entry looks the same in both tools — the
 * same paper field, glyph, words and key cap — whichever way it opens.
 *
 * It forwards `ref` and every extra prop to the `<button>`, so a popover
 * library can render it as its trigger.
 */
export function SearchFieldTrigger({
  label,
  labelClassName,
  shortcut,
  className,
  ref,
  type = 'button',
  ...buttonProps
}: SearchFieldTriggerProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('su-search-field su-search-field--trigger', FOCUS_RING, className)}
      {...buttonProps}
    >
      <Search size={14} strokeWidth={2.5} aria-hidden="true" style={GLYPH} />
      <span className={cn('su-search-field__input su-search-field__label', labelClassName)}>
        {label}
      </span>
      {shortcut && (
        <span aria-hidden="true" style={SHORTCUT}>
          <kbd style={KEY_CAP}>{shortcut}</kbd>
        </span>
      )}
    </button>
  )
}
