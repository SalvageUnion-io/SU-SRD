import { color } from '../../design/tokens'

/**
 * The book's colour map (ruleset, "The source"): which colour each chapter's
 * band wears. `rules` is the rules-blue band of Contents, Core Rules,
 * Salvaging, Guides and Keywords; `pilot`, `mech`, `crawler` and `denizen`
 * are the four chapters.
 */
export type ChapterTone = 'rules' | 'pilot' | 'mech' | 'crawler' | 'denizen'

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
}
