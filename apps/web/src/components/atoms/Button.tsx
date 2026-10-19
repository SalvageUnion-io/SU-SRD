import type { ComponentPropsWithRef, ElementType, ReactNode } from 'react'
import { useContext } from 'react'
import { cn } from '../../lib/cn'
import { EntitySurfaceContext } from '../entity/entitySurfaceContext'
import { BackLabel } from './BackLabel'
import type { ButtonVariantProps } from './buttonVariants'
import { buttonVariants } from './buttonVariants'

type ButtonOwnProps = ButtonVariantProps & {
  /**
   * Optional leading decorative glyph (e.g. the ⚄ roll die), rendered
   * `aria-hidden` before the label. The button's flex `gap` spaces it from
   * the text, so callers pass just the label as `children`.
   */
  glyph?: ReactNode
  /**
   * A way back (chrome K11): the children are the place's name ("Hangar"),
   * drawn as `BackLabel` at the button's Size, read "Back to Hangar".
   */
  back?: boolean
}

type ButtonAsButton = ButtonOwnProps &
  ComponentPropsWithRef<'button'> & { href?: undefined; linkAs?: undefined }

type ButtonAsLink = ButtonOwnProps &
  Omit<ComponentPropsWithRef<'a'>, 'href'> & {
    /** A link drawn as a button (ruleset §6.5): an app route, a site path or a URL. */
    href: string
    /**
     * The link's element, when the host is outside the surface that provides
     * one (the Union bar's drawer passes its own). Otherwise a root-relative
     * `href` takes the surface's router link (`linkAs`: `AppLink` in the app)
     * and anything else, or a static page with no surface, a plain anchor.
     */
    linkAs?: ElementType
  }

type ButtonProps = ButtonAsButton | ButtonAsLink

/** The glyph Size a Button's label line takes (chrome K11). */
const LABEL_SIZE = { full: 'full', compact: 'compact', mini: 'mini', iconOnly: 'compact' } as const

/**
 * App-chrome button (design-spec §2.4 `.btn`): paper/ink default with
 * `primary` (rust — THE action color), `ghost`, `danger` variants and the
 * canonical `full`/`compact`/`mini` size rungs (styles/sizing.ts). An
 * optional leading `glyph` (e.g. '⚄ Roll') renders
 * aria-hidden before the label. Disabled = opacity .4, pointer-events none.
 *
 * With `href` it is a link drawn as a button (ruleset §6.5), the one way to
 * draw one: it renders the surface's router link (`AppLink`, which the app's
 * root provides as `linkAs`) for a root-relative path, and a plain anchor for
 * anything else and on a static SRD page, where there is no router and none
 * is bundled. `back` draws its children as `BackLabel`.
 *
 * `surface="instrument"` re-skins the same button for Play's dark canvas
 * (condensed caps; a `ghost` recolour, the one variant the HUD uses) — one
 * Button for both the paper app chrome and the instrument scope.
 * On an ink ground (the frame's `data-ground="ink"`, chrome K1) the outlined
 * button (`default` or `ghost`) is the on-ink ghost, a paper outline, in CSS:
 * the ground is never a prop.
 */
export function Button(props: ButtonProps) {
  const surfaceLink = useContext(EntitySurfaceContext).linkAs
  const { variant, surface, size, className, glyph, back, children, ...rest } = props
  const classes = cn(buttonVariants({ variant, surface, size }), className)
  const label = (
    <>
      {glyph != null && <span aria-hidden="true">{glyph}</span>}
      {back ? <BackLabel to={children} size={LABEL_SIZE[size ?? 'compact']} /> : children}
    </>
  )

  if ('href' in rest && rest.href !== undefined) {
    const { href, linkAs, ...anchor } = rest as Omit<ButtonAsLink, keyof ButtonOwnProps>
    const Link: ElementType = linkAs ?? (surfaceLink && href.startsWith('/') ? surfaceLink : 'a')
    return (
      <Link href={href} className={classes} {...anchor}>
        {label}
      </Link>
    )
  }

  const {
    type = 'button',
    linkAs: _none,
    ...button
  } = rest as Omit<ButtonAsButton, keyof ButtonOwnProps>
  return (
    <button type={type} className={classes} {...button}>
      {label}
    </button>
  )
}
