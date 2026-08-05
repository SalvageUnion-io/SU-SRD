import { createFileRoute } from '@tanstack/react-router'
import { Changelog, mergeChangelogs, PageHeading, parseChangelog } from 'component-lib'
import refMd from '../../../../packages/salvageunion-reference/CHANGELOG.md?raw'
import itunMd from '../../CHANGELOG.md?raw'

export const Route = createFileRoute('/changelog')({
  component: ChangelogPage,
})

const entries = mergeChangelogs(parseChangelog(itunMd, 'App'), parseChangelog(refMd, 'Data'))

function ChangelogPage() {
  return (
    <main className="min-h-screen bg-wk-bg px-4 py-8 sm:px-8 sm:py-12 lg:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b-2 border-ink pb-5">
          <PageHeading className="w-fit">Changelog</PageHeading>
          <p className="mt-2 font-body text-sm text-wk-muted">
            What's new in In the Union Now and the Salvage Union reference data.
          </p>
        </header>

        <Changelog entries={entries} />
      </div>
    </main>
  )
}
