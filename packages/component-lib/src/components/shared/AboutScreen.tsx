/**
 * AboutScreen — the /about page for In the Union Now.
 *
 * Static content page: what ITUN is, its local-first stance, links to the SRD
 * and the official game, and the shared `Colophon` (author bio, special thanks,
 * LLM statement, Ko-fi support widget). Styled in the ITUN paper/ink Workshop-Manual idiom
 * (mirrors the Roster main layout) rather than the SRD reference-site look, so
 * it reads as part of this app.
 */

import { PageHeading } from '../chrome/PageHeading'
import { Slab } from '../chrome/Slab'
import { Colophon } from './Colophon'

type AboutScreenProps = {
  /** The consuming app's version — passed in so this stays app-agnostic
   * (it used to import ITUN's package.json directly, which is what kept it
   * pinned to that one app). */
  version: string
  /** Raw `ABOUT_JRVS.md`, passed in for the same reason: the library reads no
   * files, so each app inlines the repo-root documents its own way. */
  aboutJrvs: string
  /** Raw `LLM_STATEMENT.md`, same contract as `aboutJrvs`. */
  llmStatement: string
  /** Raw `SPECIAL_THANKS.md`, same contract as `aboutJrvs`. */
  specialThanks: string
}

export function AboutScreen({ version, aboutJrvs, llmStatement, specialThanks }: AboutScreenProps) {
  return (
    <main className="min-h-screen bg-wk-bg px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b-2 border-ink pb-5">
          <PageHeading className="w-fit">About</PageHeading>
          <p className="mt-2 font-body text-sm text-wk-muted">
            In the Union Now — a character builder &amp; game manager for Salvage Union.
          </p>
        </header>

        <section className="flex flex-col gap-3 font-body text-sm leading-relaxed text-ink">
          <Slab as="h2" variant="solid" label="What is this?" className="mb-0" />
          <p>
            <strong>In the Union Now</strong> is an unofficial, community-built character builder
            and game manager for{' '}
            <a
              href="https://leyline.press/pages/salvage-union"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rust hover:underline"
            >
              Salvage Union
            </a>
            , the post-apocalyptic mech tabletop RPG published by{' '}
            <a
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rust hover:underline"
            >
              Leyline Press
            </a>
            . Build pilots, mechs, and crawlers, then run them at the table with live sheets and
            shareable snapshots.
          </p>
          <p>
            It's <strong>local-first</strong>: everything you create is stored privately in your own
            browser. There's no account and no server — export a backup any time to move your builds
            between devices.
          </p>
          <p>
            Looking for the rules? Browse the full searchable reference at{' '}
            <a
              href="https://salvageunion.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rust hover:underline"
            >
              salvageunion.io
            </a>
            .
          </p>
          <p>
            I am not the owner or publisher of this content. Salvage Union and all associated names,
            marks, characters, and artwork are the property of Leyline Press. Game text and
            mechanics are used under the{' '}
            <a
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rust hover:underline"
            >
              Salvage Union Open Game Licence 1.0b
            </a>
            . Artwork is not covered by that licence and is reproduced with the special permission
            of Leyline Press. This is an unofficial fan project, and is not affiliated with Leyline
            Press.
          </p>
        </section>

        <Colophon
          aboutMarkdown={aboutJrvs}
          llmMarkdown={llmStatement}
          specialThanksMarkdown={specialThanks}
          kofiCode="C3Z82382ZC"
          className="border-t-2 border-ink pt-6 font-body text-ink"
          footer={<p className="font-body text-xs text-wk-muted">Version {version}</p>}
        />
      </div>
    </main>
  )
}
