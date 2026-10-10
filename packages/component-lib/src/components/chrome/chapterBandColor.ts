import { color } from '../../design/tokens'

/**
 * The book's colour map (ruleset, "The source"): which colour each chapter's
 * band wears. `rules` is the rules-blue band of Contents, Core Rules,
 * Salvaging, Guides and Keywords; `pilot`, `mech`, `crawler` and `denizen`
 * are the four chapters. `ink` is no chapter of the book: it is the dark band
 * of a page that is the player's own rather than the book's — ITUN's Shelves
 * (board S1) — and it carries paper flecks and paper text (ruleset §3.5).
 */
export type ChapterTone = 'rules' | 'pilot' | 'mech' | 'crawler' | 'denizen' | 'ink'

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
}
