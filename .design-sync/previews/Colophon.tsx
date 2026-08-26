/*
 * Ported from packages/component-lib/src/components/shared/Colophon.stories.tsx.
 *
 * The story reads the three repo-root documents with Vite's `?raw` suffix. The
 * preview compiler is esbuild, which has no `?raw`, so they are imported plainly
 * and `cfg.storyImports.loaders` maps `.md` to `text` — same files, same
 * content, different loader.
 */
import { Colophon } from 'component-lib'
import aboutMd from '../../ABOUT_JRVS.md'
import statementMd from '../../LLM_STATEMENT.md'
import thanksMd from '../../SPECIAL_THANKS.md'

/**
 * The real repo-root `ABOUT_JRVS.md` + `SPECIAL_THANKS.md` + `LLM_STATEMENT.md`,
 * rendered through the same block both about pages use — so this card shows the
 * wording that actually ships.
 */
export function RepoDocuments() {
  return (
    <div className="bg-paper p-4">
      <Colophon
        aboutMarkdown={aboutMd}
        llmMarkdown={statementMd}
        specialThanksMarkdown={thanksMd}
        kofiCode="C3Z82382ZC"
        className="font-body text-ink"
      />
    </div>
  )
}
