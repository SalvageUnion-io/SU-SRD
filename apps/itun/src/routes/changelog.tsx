import { createFileRoute } from '@tanstack/react-router'
import { Changelog, ChapterBand } from 'component-lib'
import { pageTitle } from '../lib/pageTitle'

export const Route = createFileRoute('/changelog')({
  head: () => ({ meta: [{ title: pageTitle('Changelog') }] }),
  component: ChangelogPage,
})

function ChangelogPage() {
  return (
    <main className="min-h-screen bg-wk-bg px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b-2 border-ink pb-5">
          <ChapterBand>Changelog</ChapterBand>
          <p className="mt-2 font-body text-sm text-wk-muted">What's new in In the Union Now.</p>
        </header>

        <Changelog entries={__ITUN_CHANGELOG__} />
      </div>
    </main>
  )
}
