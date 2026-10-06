import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { UserRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import { borderWidth, color, font, radius, weight } from '../../design/tokens'

/**
 * Avatar — a person's picture in a circle, or their initial when there is no
 * picture to show.
 *
 * Base UI's `Avatar` does the part that is easy to get wrong: it only swaps the
 * `<img>` in once the image has actually loaded, so a missing URL, a 404 and a
 * slow network all land on the same fallback instead of a broken-image glyph.
 * The fallback is the first character of `name`, or a generic person glyph
 * when there is no name to take one from.
 *
 * **Decorative by construction.** The circle is always hidden from assistive
 * technology, because it never stands alone: the name is either printed beside
 * it or carried by the control it sits in (an avatar-only menu button labels
 * itself). An avatar that announced "Beefcake" next to the text "Beefcake"
 * would say everything twice.
 *
 * Every property here is static, so the styling is style objects read from
 * `tokens` — no stylesheet class (the per-property split rule in the package
 * CLAUDE.md).
 */

type AvatarProps = {
  /** Image URL. `null`/omitted — or one that fails to load — shows the initial. */
  src?: string | null
  /** Whose avatar it is. Supplies the fallback initial; never announced. */
  name: string
  /** Diameter in px. */
  size?: number
}

/** The first character a reader would call the name's initial, uppercased. */
function initialOf(name: string): string | null {
  // `Array.from` splits by code point, so a name starting with an emoji or an
  // astral-plane letter yields the whole character rather than half a pair.
  const first = Array.from(name.trim())[0]
  return first === undefined ? null : first.toLocaleUpperCase()
}

export function Avatar({ src, name, size = 28 }: AvatarProps) {
  const initial = initialOf(name)

  const rootStyle = {
    alignItems: 'center',
    backgroundColor: color.rust,
    borderColor: color.paper30,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: borderWidth.hairline,
    boxSizing: 'border-box',
    color: color.paper,
    display: 'inline-flex',
    flexShrink: 0,
    fontFamily: font.cond,
    // Scales with the circle: an initial is read at a glance, not studied.
    fontSize: `${Math.round(size * 0.46)}px`,
    fontWeight: weight.bold,
    height: `${size}px`,
    justifyContent: 'center',
    lineHeight: 1,
    overflow: 'hidden',
    userSelect: 'none',
    width: `${size}px`,
  } satisfies CSSProperties

  return (
    <BaseAvatar.Root style={rootStyle} aria-hidden="true">
      {src ? <BaseAvatar.Image src={src} alt="" style={IMAGE} /> : null}
      <BaseAvatar.Fallback>
        {initial ?? <UserRound size={Math.round(size * 0.6)} aria-hidden="true" />}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  )
}

const IMAGE = {
  display: 'block',
  height: '100%',
  objectFit: 'cover',
  width: '100%',
} satisfies CSSProperties
