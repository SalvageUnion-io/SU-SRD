/**
 * AboutScreen — the /about page for In the Union Now.
 *
 * Static content page: what ITUN is, its local-first stance, links to the SRD
 * and the official game, and the official Ko-fi support widget (shared
 * KofiButton from component-lib). Styled in the ITUN paper/ink Workshop-Manual
 * idiom (mirrors the Roster main layout) rather than the SRD reference-site
 * look, so it reads as part of this app.
 */

import { KofiButton } from 'component-lib'

import { version } from '../../../package.json'

export function AboutScreen() {
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
              className="font-semibold text-su-orange-dark hover:underline"
            >
              Salvage Union
            </a>
            , the post-apocalyptic mech tabletop RPG published by{' '}
            <a
              href="https://leyline.press"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-su-orange-dark hover:underline"
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
              className="font-semibold text-su-orange-dark hover:underline"
            >
              salvageunion.io
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col items-start gap-3 border-t-2 border-ink pt-6">
          <h2 className="font-cond text-lg font-bold uppercase tracking-caps-tight text-rust">
            Support the project
          </h2>
          <p className="font-body text-sm leading-relaxed text-ink">
            These tools are free and open source. If they've been useful at your table, you can chip
            in toward hosting and development.
          </p>
          <KofiButton code="C3Z82382ZC" />
          <p className="font-body text-xs text-wk-muted">
            Version {version} —{' '}
            <a href="/changelog" className="font-semibold text-su-orange-dark hover:underline">
              view changelog
            </a>
          </p>
        </section>
      </div>
    </main>
  )
}
