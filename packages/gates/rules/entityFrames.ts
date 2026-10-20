/**
 * The entity-frame half of `chrome-tokens` (`chromeTokens.ts` runs it as
 * `entity-frame-ink`, hard rule R38): what a stylesheet rule or a style
 * object may paint on an entity's frame.
 */

import type { CssDecl } from '../lib/styleSource'
import { matchesIn } from '../lib/styleSource'

/**
 * An entity's frame (ruleset §4.3, owner's call 2026-10-20): the subtle
 * `--color-ink-40` the sheets' panels wear, never solid ink nor a per-entity
 * tone. Only `--su-row-frame` colours one (an ability tree's tier, a
 * pattern's colour).
 */
const ENTITY_FRAME_CLASSES = [
  'su-entity-row__frame',
  'su-entity-tile__frame',
  'su-ec-frame',
  'su-entity-token__pill',
  'su-entity-token__body',
  'su-token-group',
]

/** Where a style object paints an entity's frame (a Card's, a choice option's, a contentful Token's body, a TokenGroup's). */
export const ENTITY_FRAME_STYLE_FILES: readonly string[] = [
  'apps/web/src/components/referenceEntity/card/cardChrome.ts',
  'apps/web/src/components/referenceEntity/choiceCard/ChoiceGroups.tsx',
  'apps/web/src/components/entity/forms/Token.tsx',
  'apps/web/src/components/entity/forms/TokenGroup.tsx',
]

const FRAME_COLOUR_PROP =
  /^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?$/
const SOLID_INK = /var\(--color-ink(?:-2|-deep)?\)/

/** Does any selector of the list draw its subject on an entity frame (its last compound names one)? */
function framesAnEntity(header: string): boolean {
  return header.split(',').some((sel) => {
    const subject =
      sel
        .trim()
        .split(/\s*[\s>+~]\s*/)
        .at(-1) ?? ''
    return ENTITY_FRAME_CLASSES.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(subject))
  })
}

export const entityFrameInkCss = (decls: CssDecl[]) =>
  decls
    .filter((d) => FRAME_COLOUR_PROP.test(d.prop) && !/-width$|-style$/.test(d.prop))
    .filter((d) => SOLID_INK.test(d.value) && framesAnEntity(d.context.at(-1) ?? ''))
    .map((d) => ({ line: d.line, detail: `${d.context.at(-1)} { ${d.prop}: ${d.value} }` }))

/** The values a frame's `borderColor` may take: the subtle ink, clear, or the tree's or pattern's colour. */
const FRAME_COLOUR_OK =
  /^(?:(?:tokens\.)?color\.ink40|['"`]var\(--color-ink-40\)['"`]|['"`]transparent['"`]|['"`]var\(--su-row-frame[^'"`]*['"`])$/

export const entityFrameInkScript = (text: string, rel: string) =>
  ENTITY_FRAME_STYLE_FILES.includes(rel)
    ? matchesIn(
        text,
        /\bborderColor\s*:\s*('[^'\n]*'|"[^"\n]*"|`[^`\n]*`|[^,}\n]+)/g,
        (m) => !FRAME_COLOUR_OK.test((m[1] ?? '').trim())
      )
    : []
