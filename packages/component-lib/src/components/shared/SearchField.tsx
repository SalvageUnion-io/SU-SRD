import { Search } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cn } from '../../utils/cn'
import { FOCUS_WITHIN } from '../chrome/interaction'

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

type SearchFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Overrides merged onto the bordered container (e.g. taller padding, larger text). */
  containerClassName?: string
  /** Magnifier glyph size in px. */
  glyphSize?: number
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { containerClassName, glyphSize = 14, className, ...inputProps },
  ref
) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded border border-ink bg-paper px-3 py-[7px] font-body text-caption text-wk-muted',
        FOCUS_WITHIN,
        containerClassName
      )}
    >
      <Search
        size={glyphSize}
        strokeWidth={2.5}
        aria-hidden="true"
        className="shrink-0 opacity-60"
      />
      <input
        ref={ref}
        className={cn(
          // `text-base` (16px) is REQUIRED, not a style choice, and it must sit
          // on the input rather than the container. iOS Safari zooms the page
          // whenever a focused form control renders below 16px — so the
          // container's `text-caption`, which the input would otherwise
          // inherit, made every tap on search yank the viewport. Measured at
          // 390px against the built output: 13px inherited here before this.
          //
          // Only the input is raised. The container stays `text-caption` so the
          // glyph and the field's own metrics are unchanged, which keeps the
          // header search the same size it has always been.
          'w-full bg-transparent text-base text-ink placeholder:text-wk-muted focus:outline-none',
          className
        )}
        {...inputProps}
      />
    </div>
  )
})
