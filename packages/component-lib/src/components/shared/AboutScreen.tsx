/**
 * AboutScreen — the /about page for In the Union Now.
 *
 * Static content page: what ITUN is, its local-first stance, links to the SRD
 * and the official game, and the shared `Colophon` (author bio, LLM statement,
 * Ko-fi support widget). Styled in the ITUN paper/ink Workshop-Manual idiom
 * (mirrors the Roster main layout) rather than the SRD reference-site look, so
 * it reads as part of this app.
 */

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
}

export function AboutScreen({ version, aboutJrvs, llmStatement }: AboutScreenProps) {
  return (
    <main className="min-h-screen bg-wk-bg px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b-2 border-ink pb-5">
          <h1 className="font-cond text-3xl font-bold uppercase tracking-caps-tight text-ink">
            About
          </h1>
          <p className="mt-2 font-body text-sm text-wk-muted">
            In the Union Now — a character builder &amp; game manager for Salvage Union.
          </p>
        </header>

        <section className="flex flex-col gap-3 font-body text-sm leading-relaxed text-ink">
          <h2 className="font-cond text-lg font-bold uppercase tracking-caps-tight text-rust">
            What is this?
          </h2>
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
        </section>

        <Colophon
          aboutMarkdown={aboutJrvs}
          llmMarkdown={llmStatement}
          kofiCode="C3Z82382ZC"
          className="border-t-2 border-ink pt-6 font-body text-ink"
          headingClassName="tracking-caps-tight text-rust"
          footer={
            <p className="font-body text-xs text-wk-muted">
              Version {version} —{' '}
              <a href="/changelog" className="font-semibold text-rust hover:underline">
                view changelog
              </a>
            </p>
          }
        />
      </div>
    </main>
  )
}
