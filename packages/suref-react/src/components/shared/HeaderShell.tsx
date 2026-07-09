import type { ElementType, ReactNode } from 'react'

import { cn } from '../../utils/cn'

/**
 * HeaderShell — the shared brand chrome for both SU surfaces (the SRD reference
 * site `suref-web` and the `in-the-union-now` builder). It owns the container
 * styling and the brand lockup (SU cargo mark + font-cond wordmark + tracked
 * eyebrow) so the two apps read as siblings; each app supplies its own
 * right-side actions via `children`.
 *
 * The canonical look is the SRD site's signature header (su-ink-dark ground,
 * 3px su-orange-dark bottom border, 26→34px wordmark, 13px/0.22em eyebrow).
 *
 * Data-source agnostic (per suref-react conventions): the brand is described
 * with primitive props so it renders identically from Astro (static, no islands
 * inside the lockup) and from React. `HomeLink` lets React consumers inject a
 * router-aware link (ITUN's AppLink); it defaults to a plain anchor for Astro.
 */

const CONTAINER_CLASS =
  'flex items-center gap-[14px] bg-su-ink-dark px-5 py-3 z-50 border-b-[3px] border-su-orange-dark sm:px-[34px] sm:py-[14px]'

type HeaderShellProps = {
  /** Destination for the brand/home link (e.g. "/"). */
  homeHref: string
  /** Primary wordmark text (e.g. "SalvageUnion", "ITUN"). */
  wordmark: string
  /** Optional accent appended to the wordmark, rendered in orange (e.g. ".io"). */
  wordmarkAccent?: string
  /** Optional badge pill after the wordmark (e.g. "Beta"). */
  badge?: string
  /** Small uppercase eyebrow beneath the wordmark. */
  eyebrow: string
  /** Logo image src (defaults to the SU cargo mark, present in both apps' public dirs). */
  logoSrc?: string
  logoAlt?: string
  /** Link component for the brand. Defaults to a plain anchor; ITUN passes AppLink. */
  HomeLink?: ElementType
  /**
   * Allow the brand lockup to shrink so a long wordmark/eyebrow wraps instead
   * of forcing horizontal overflow (ITUN's "IN THE UNION NOW" +
   * "A Salvage Union Character Manager"). Defaults to false — the brand stays
   * `shrink-0`, preserving the SRD's single-line lockup exactly.
   */
  brandShrink?: boolean
  /** Right-side actions — unique per app (nav links, search, outbound cross-link). */
  children?: ReactNode
  /** Extra classes merged onto the container. */
  className?: string
  /**
   * Stable CSS `view-transition-name` for the header. Astro's ClientRouter uses
   * it to keep the (identical) bar pinned across client-side navigations instead
   * of cross-fading it. Astro's `transition:*` directives don't forward onto a
   * framework component's root, so suref-web passes the name here instead.
   */
  viewTransitionName?: string
}

export function HeaderShell({
  homeHref,
  wordmark,
  wordmarkAccent,
  badge,
  eyebrow,
  logoSrc = '/logos/su-cargo-dark.svg',
  logoAlt = 'Salvage Union',
  HomeLink = 'a',
  brandShrink = false,
  children,
  className,
  viewTransitionName,
}: HeaderShellProps) {
  return (
    <header
      className={cn(CONTAINER_CLASS, className)}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      {/* Brand: SU cargo mark + wordmark (+ optional accent/badge) + eyebrow.
          With `brandShrink`, the lockup may shrink (min-w-0) so a long
          wordmark/eyebrow wraps instead of forcing horizontal overflow; the
          default keeps it `shrink-0`, preserving the SRD's single-line lockup. */}
      <HomeLink
        href={homeHref}
        className={cn(
          'flex items-center gap-[14px] no-underline',
          brandShrink ? 'min-w-0' : 'shrink-0'
        )}
      >
        <img
          src={logoSrc}
          alt={logoAlt}
          width={64}
          height={64}
          className="block size-12 shrink-0 rounded-xl sm:size-16"
        />
        <span className="flex min-w-0 flex-col">
          <span className="font-cond text-[26px] font-bold leading-[0.98] tracking-[0.005em] text-su-paper sm:text-[34px]">
            {wordmark}
            {wordmarkAccent && <span className="text-su-orange-dark">{wordmarkAccent}</span>}
            {badge && (
              <span className="ml-2 inline-block rounded bg-rust px-1.5 py-0.5 align-[0.32em] font-cond text-[13px] font-bold uppercase leading-none tracking-[0.08em] text-su-paper">
                {badge}
              </span>
            )}
          </span>
          <span
            className={cn(
              'mt-[7px] font-cond text-[13px] font-semibold uppercase tracking-[0.22em] text-su-orange sm:mt-[9px]',
              // When the brand can shrink, let a long eyebrow wrap (with room
              // between lines); otherwise keep the SRD's single-line eyebrow.
              brandShrink ? 'leading-tight' : 'whitespace-nowrap leading-none'
            )}
          >
            {eyebrow}
          </span>
        </span>
      </HomeLink>
      {children}
    </header>
  )
}
