import { color } from '../../design/tokens'

/**
 * The words and sizes of an `OgCard` (issue 1280): its props, the canvas, and
 * what its unfurl says beside the image — `og:title` (the name),
 * `og:description` (the kicker and byline, never the body) and `theme-color`
 * (the band's tone). A module of its own so a page's `<head>` can read them
 * without the component, and so `OgCard.tsx` exports only the component.
 */

/** The canvas: the size every unfurl draws a "large" card at. */
export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/** One framed stat box: a short label over its value ("SP" over "9"). */
export type OgCardStat = { label: string; value: string }

type OgCardBase = {
  /** The caps line on the band: "Chassis · Tech Level 1". */
  kicker: string
  /** The notched title: the thing's name. */
  title: string
  /** The address the foot prints (a path on the SRD, host and path on ITUN). */
  address: string
}

export type OgCardProps =
  | (OgCardBase & {
      kind: 'thing'
      /** The band colour: the entity's tone, any CSS colour. */
      tone: string
      stats: OgCardStat[]
      /** The page cite: "Salvage Union Workshop Manual · p.104". */
      cite?: string
    })
  | (OgCardBase & {
      kind: 'do'
      /** The book's tier numeral, for an ability. */
      tier?: string
      /** The cost as the pennant prints it: "2 AP". */
      cost?: string
      /** The rules text, clamped to two lines. */
      rules?: string
      cite?: string
    })
  | (OgCardBase & {
      kind: 'sheet'
      tone: string
      stats: OgCardStat[]
      /** "Rosa's pilot · Reclamation of the Wastes". */
      byline: string
    })
  | (OgCardBase & {
      kind: 'userMade'
      tone: string
      stats: OgCardStat[]
      /** The maker's name; the byline reads "Made by [user]" and nothing else. */
      madeBy: string
    })
  | (OgCardBase & {
      kind: 'invite'
      tone: string
      /** "Mediated by alxjrvs. …" — what the invite tells its bearer, no more. */
      summary: string
      /** "Link expires 15 Oct · the Mediator lets you in". */
      terms?: string
    })
  | { kind: 'private'; address: string }

export type OgCardKind = OgCardProps['kind']

/** The kinds the SRD renders; every other kind is ITUN's. */
export const REFERENCE_KINDS: ReadonlySet<OgCardKind> = new Set(['thing', 'do'])

/**
 * The band's colour for a card — the entity's tone, the ink of a thing you do,
 * or the ink-deep of a private card. Also the page's `theme-color`, so
 * Discord's side bar matches the band: see `ogCardThemeColor`.
 */
export function bandColor(props: OgCardProps): string {
  if (props.kind === 'do' || props.kind === 'private') return color.inkDeep
  return props.tone
}

/**
 * The card's `theme-color`: the band's colour as a literal. A `var(--color-x)`
 * tone resolves to its token, since a `<meta>` cannot read a custom property.
 */
export function ogCardThemeColor(props: OgCardProps): string {
  const band = bandColor(props)
  const variable = band.match(/^var\(--color-([a-z0-9-]+)\)$/)
  if (!variable) return band
  const key = (variable[1] ?? '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  return (color as Record<string, string>)[key] ?? band
}

/** The line under the stats: the cite, the byline, or "Made by [user]". */
export function bylineOf(props: OgCardProps): string | undefined {
  switch (props.kind) {
    case 'thing':
    case 'do':
      return props.cite
    case 'sheet':
      return props.byline
    case 'userMade':
      return `Made by ${props.madeBy}`
    case 'invite':
      return props.terms
    case 'private':
      return PRIVATE_LINE
  }
}

/** The `og:title`: the thing's name, or "Private". */
export function ogCardTitle(props: OgCardProps): string {
  return props.kind === 'private' ? PRIVATE_TITLE : props.title
}

/**
 * The `og:description`: the kicker and the byline, never the body (issue
 * 1280). An invite's summary is its byline: it is what the invite says.
 */
export function ogCardDescription(props: OgCardProps): string {
  if (props.kind === 'private') return PRIVATE_LINE
  const byline = props.kind === 'invite' ? props.summary : bylineOf(props)
  return [props.kicker, byline].filter((part) => part && part.length > 0).join(' · ')
}

export const PRIVATE_TITLE = 'Private'
export const PRIVATE_LINE = "Its owner hasn't shared this."

/**
 * The notch's font size for a name: 120px when it fits, stepping down so a
 * long name stays on one line, and never under 56px. Barlow Semi Condensed
 * caps set about half an em per character; the notch has about 1028px.
 */
export function ogTitleSize(title: string): number {
  const fit = Math.floor(1028 / (0.52 * Math.max(title.length, 1)))
  return Math.max(56, Math.min(120, fit))
}
