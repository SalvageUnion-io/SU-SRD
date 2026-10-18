import { color } from '../../design/tokens'

/**
 * The book's colour map (ruleset, "The source"): which colour each chapter's
 * band wears. `rules` is the rules-blue band of Contents, Core Rules,
 * Salvaging, Guides and Keywords; `pilot`, `mech`, `crawler` and `denizen`
 * are the four chapters. `ink` is no chapter of the book: it is the dark band
 * of a page that is the player's own rather than the book's — the Cantina's Shelves
 * (board S1) — and it carries paper flecks and paper text (ruleset §3.5).
 * `cantina` is no chapter either: it is The Cantina's own band, the builder's
 * pages that are neither a chapter nor the player's shelves (its front door,
 * Play, Settings, sign-in, invites, the Starter Set), so they stop wearing
 * the SRD's rules-blue. It is the Legendary tier pink (the crawler chapter's
 * colour), and like the crawler band it carries ink text.
 */
export type ChapterTone = 'rules' | 'pilot' | 'mech' | 'crawler' | 'denizen' | 'ink' | 'cantina'

/**
 * Each chapter's band colour — the head band (`ChapterBand`), the foot band
 * (`ChapterFoot`), and the SRD Contents page's chapter rules.
 */
export const CHAPTER_BAND_COLOR: Record<ChapterTone, string> = {
  rules: color.wkLine,
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawler,
  denizen: color.denizenBand,
  ink: color.ink,
  cantina: color.crawler,
}
