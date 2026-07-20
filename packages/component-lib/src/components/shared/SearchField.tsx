import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../../utils/cn'

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
        'flex items-center gap-2 rounded border border-ink bg-paper px-3 py-[7px] font-body text-caption text-ink-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pilot',
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
          'w-full bg-transparent text-ink placeholder:text-ink-2 focus:outline-none',
          className
        )}
        {...inputProps}
      />
    </div>
  )
})
