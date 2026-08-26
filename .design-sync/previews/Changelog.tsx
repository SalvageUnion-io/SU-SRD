/* Ported from packages/component-lib/src/changelog/Changelog.stories.tsx. */
import { Changelog } from 'component-lib'
import { Caption } from '../preview-lib/harness'

// Real-shaped release entries, as release-please produces them across the Site
// and Data changelogs.
const ENTRIES = [
  {
    date: '2026-07-18',
    version: '1.4.0',
    area: 'Site',
    items: [
      'Add a Ko-fi support link and a new In the Union Now About page',
      'Derived, per-app release changelogs from conventional-commit PR titles',
    ],
  },
  {
    date: '2026-07-12',
    version: '1.3.0',
    area: 'Data',
    items: [
      'Model Eldridge Coast companions as equipment loadouts',
      'Condition + uses tracking for drone loadout items',
    ],
  },
  {
    date: '2026-07-04',
    title: 'Crawler bays',
    area: 'Data',
    items: ['One Crawler Bay type; homebrew bays grouped underneath'],
  },
]

/** The merged release list — each entry a paper panel with an area badge. */
export function Releases() {
  return (
    <div className="flex max-w-2xl flex-col gap-3 bg-paper p-4">
      <Caption>newest first — version/title headline, area badge, date, items</Caption>
      <Changelog entries={ENTRIES} />
    </div>
  )
}

/** The empty state — no releases yet. */
export function Empty() {
  return (
    <div className="max-w-2xl bg-paper p-4">
      <Changelog entries={[]} />
    </div>
  )
}
