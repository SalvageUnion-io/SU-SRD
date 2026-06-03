/**
 * sheetAccent — per-entity-kind accent tokens for the live sheet chrome.
 *
 * Maps each entity kind to the SRD semantic color tokens (pilot = orange,
 * mech = green, crawler = pink) exposed by the suref-react `@theme` block as
 * Tailwind v4 utilities (`bg-pilot`, `text-mech`, `border-crawler`, …). These
 * are used to accent visual chrome only — section headers, the SheetHeader
 * band, the segment-switcher active state, and per-section dividers — never
 * functional state colors (damage red, heat tones, warnings).
 *
 * Resolved once in Sheet.tsx and threaded down so the three sheets stay
 * consistent and mirror how the SRD accents these entity types.
 */

import type { SheetSegment } from './SheetSegmentSwitcher'

export type SheetAccent = {
  /** Background utility for filled chrome (header band, active segment). */
  bg: string
  /** Foreground utility paired with `bg` for legible contrast. */
  bgText: string
  /** Border-color utility for accent borders / dividers. */
  border: string
  /** Text-color utility for accented labels. */
  text: string
  /**
   * Hover background for an *active* filled segment. Re-states the kind's own
   * color (dimmed) so it wins over the button `default` variant's rust hover
   * via tailwind-merge — the fill must stay its kind color on hover.
   */
  hoverBg: string
  /**
   * Hover chrome for an *inactive* outlined segment: a soft tint of the kind's
   * color with its label/border, so hovering reads as the segment's own kind
   * rather than the button `outline` variant's orange hover.
   */
  hoverBgTint: string
  /** Hover border paired with `hoverBgTint` for the inactive segment. */
  hoverBorder: string
  /** Hover label color paired with `hoverBgTint` for the inactive segment. */
  hoverText: string
}

/**
 * Accent by entity kind. Pilot reads orange, mech green, crawler pink — the
 * same semantic mapping the SRD uses for these entity types.
 *
 * Crawler has no `-dark` token, so its filled band pairs pink with white for
 * contrast; pilot/mech bands sit on the dark ink text for legibility.
 */
export const SHEET_ACCENTS: Record<SheetSegment, SheetAccent> = {
  pilot: {
    bg: 'bg-pilot',
    bgText: 'text-su-black',
    border: 'border-pilot',
    text: 'text-pilot',
    hoverBg: 'hover:bg-pilot/90',
    hoverBgTint: 'hover:bg-pilot/15',
    hoverBorder: 'hover:border-pilot',
    hoverText: 'hover:text-pilot',
  },
  mech: {
    bg: 'bg-mech',
    bgText: 'text-su-black',
    border: 'border-mech',
    text: 'text-mech',
    hoverBg: 'hover:bg-mech/90',
    hoverBgTint: 'hover:bg-mech/15',
    hoverBorder: 'hover:border-mech',
    hoverText: 'hover:text-mech',
  },
  crawler: {
    bg: 'bg-crawler',
    bgText: 'text-su-white',
    border: 'border-crawler',
    text: 'text-crawler',
    hoverBg: 'hover:bg-crawler/90',
    hoverBgTint: 'hover:bg-crawler/15',
    hoverBorder: 'hover:border-crawler',
    hoverText: 'hover:text-crawler',
  },
}

/** Resolve the accent for an entity kind. */
export function sheetAccentFor(kind: SheetSegment): SheetAccent {
  return SHEET_ACCENTS[kind]
}
