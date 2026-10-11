/**
 * AboutScreen — the /about page for In the Union Now.
 *
 * Static content page: what ITUN is, its local-first stance, links to the SRD
 * and the official game, and the shared `Colophon` (author bio, special thanks,
 * LLM statement, Ko-fi support widget). Styled in the ITUN paper/ink Workshop-Manual idiom
 * (mirrors the Roster main layout) rather than the SRD reference-site look, so
 * it reads as part of this app.
 */

import { Colophon, InlineRef, PageHeading, Slab } from 'component-lib'

type AboutScreenProps = {
  /** The build the app is running: the deployed commit's short SHA (ADR-041).
   * Passed in so this stays app-agnostic. */
  build: string
  /** Raw `ABOUT_JRVS.md`, passed in for the same reason: the library reads no
   * files, so each app inlines the repo-root documents its own way. */
  aboutJrvs: string
  /** Raw `LLM_STATEMENT.md`, same contract as `aboutJrvs`. */
  llmStatement: string
  /** Raw `SPECIAL_THANKS.md`, same contract as `aboutJrvs`. */
  specialThanks: string
}

export function AboutScreen({ build, aboutJrvs, llmStatement, specialThanks }: AboutScreenProps) {
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
            <InlineRef
              href="https://leyline.press/pages/salvage-union"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              Salvage Union
            </InlineRef>
            , the post-apocalyptic mech tabletop RPG published by{' '}
            <InlineRef
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              Leyline Press
            </InlineRef>
            . Build pilots, mechs, and crawlers, then run them at the table with live sheets you can
            share.
          </p>
          <p>
            It's <strong>local-first</strong>: everything you create is stored privately in your own
            browser. There's no account and no server — export a backup any time to move your builds
            between devices.
          </p>
          <p>
            Looking for the rules? Browse the full searchable reference at{' '}
            <InlineRef
              href="https://salvageunion.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              salvageunion.io
            </InlineRef>
            .
          </p>
          <p>
            I am not the owner or publisher of this content. Salvage Union and all associated names,
            marks, characters, and artwork are the property of Leyline Press. Game text and
            mechanics are used under the{' '}
            <InlineRef
              href="https://leyline.press/pages/salvage-union-open-game-licence-1-0b"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold"
            >
              Salvage Union Open Game Licence 1.0b
            </InlineRef>
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
          footer={<p className="font-body text-xs text-wk-muted">Build {build}</p>}
        />
      </div>
    </main>
  )
}
