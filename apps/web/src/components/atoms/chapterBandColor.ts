import { color } from '../../design/tokens'

/**
 * The book's colour map (ruleset, "The source"): which colour each chapter's
 * band wears. `rules` is the rules-blue band of Contents, Core Rules,
 * Salvaging, Guides and Keywords; `pilot`, `mech`, `crawler` and `adversary`
 * are the four chapters: the Denizens chapter wears the adversary brown its
 * entities' cards wear. `denizen` is the navy the
 * Denizens chapter wore before, kept by the NPC designer and sheet and by
 * Play's Mediator Scene. `ink` is no chapter of the book: it is the dark band
 * of a page that is the player's own rather than the book's — Build's Shelves
 * — and it carries paper flecks and paper text (ruleset §3.5).
 * `build` and `play` are no chapters either: they are the app's two areas'
 * own bands, on their pages that are neither a chapter nor the player's
 * shelves, so they stop wearing the SRD's rules-blue, and the Union bar wears
 * the same colour on their routes (`styles/partials/shell.css`). `build`, the
 * Training Bay's, is the pilot chapter's orange and carries ink text (its
 * front door, Settings, sign-in, invites, the Starter Set); `play`, the
 * Cantina's, is the deeper crawler pink, `crawlerBand`, which carries paper
 * text (the book's crawler pink carries neither at 4.5:1).
 */
export type ChapterTone =
  | 'rules'
  | 'pilot'
  | 'mech'
  | 'crawler'
  | 'adversary'
  | 'denizen'
  | 'ink'
  | 'build'
  | 'play'

/**
 * Each chapter's band colour — the head band (`ChapterBand`, whose colour the
 * Union bar and the site foot wear) and the SRD Contents page's chapter rules.
 */
export const CHAPTER_BAND_COLOR: Record<ChapterTone, string> = {
  rules: color.wkLine,
  pilot: color.pilot,
  mech: color.mech,
  crawler: color.crawler,
  adversary: color.adversary,
  denizen: color.denizenBand,
  ink: color.ink,
  build: color.pilot,
  play: color.crawlerBand,
}
