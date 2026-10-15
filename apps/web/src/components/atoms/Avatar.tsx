import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { UserRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import { borderWidth, color, font, radius, weight } from '../../design/tokens'

/**
 * Avatar — a person's picture on a square chip, or their initials when there
 * is no picture to show. The chip takes the 3px canon radius (ruleset §4.4: a
 * circle is a rounding the book never draws).
 *
 * Base UI's `Avatar` does the part that is easy to get wrong: it only swaps the
 * `<img>` in once the image has actually loaded, so a missing URL, a 404 and a
 * slow network all land on the same fallback instead of a broken-image glyph.
 * The fallback is two initials from `name` — the first letters of its first
 * two words, or the first two letters of a one-word name — or a generic person
 * glyph when there is no name to take them from.
 *
 * **Decorative by construction.** The chip is always hidden from assistive
 * technology, because it never stands alone: the name is either printed beside
 * it or carried by the control it sits in (an avatar-only menu button labels
 * itself). An avatar that announced "Beefcake" next to the text "Beefcake"
 * would say everything twice.
 *
 * Every property here is static, so the styling is style objects read from
 * `tokens` — no stylesheet class (the per-property split rule in
 * `.claude/rules/styling.md`).
 */

type AvatarProps = {
  /** Image URL. `null`/omitted — or one that fails to load — shows the initials. */
  src?: string | null
  /** Whose avatar it is. Supplies the fallback initials; never announced. */
  name: string
  /** Side of the square chip, in px. */
  size?: number
}

/**
 * Two initials, uppercased: the first character of each of the first two
 * words ('Rae Voss' → 'RV'), or the first two characters of a one-word name
 * ('Beefcake' → 'BE'). A one-character name gives one.
 */
function initialsOf(name: string): string | null {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  // `Array.from` splits by code point, so a name starting with an emoji or an
  // astral-plane letter yields the whole character rather than half a pair.
  const chars =
    words.length >= 2
      ? words.slice(0, 2).map((word) => Array.from(word)[0] ?? '')
      : Array.from(words[0] ?? '').slice(0, 2)
  const initials = chars.join('')
  return initials === '' ? null : initials.toLocaleUpperCase()
}

export function Avatar({ src, name, size = 28 }: AvatarProps) {
  const initials = initialsOf(name)

  const rootStyle = {
    alignItems: 'center',
    backgroundColor: color.pilot,
    borderColor: color.paper30,
    borderRadius: radius.card,
    borderStyle: 'solid',
    borderWidth: borderWidth.hairline,
    boxSizing: 'border-box',
    color: color.ink,
    display: 'inline-flex',
    flexShrink: 0,
    fontFamily: font.cond,
    // Scales with the chip: initials are read at a glance, not studied.
    fontSize: `${Math.round(size * 0.43)}px`,
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
        {initials ?? <UserRound size={Math.round(size * 0.6)} aria-hidden="true" />}
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
