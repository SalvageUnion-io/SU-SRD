import type { Story } from '../stories/_harness'
import { Caption } from '../stories/_harness'
import { Changelog } from './Changelog'
import type { ChangelogEntry } from './parseChangelog'

export default { title: 'Compositions/Changelog' }

// Real-shaped release entries (version headline, area badge, newest first) as
// release-please writes them into a site's changelog.
const ENTRIES: ChangelogEntry[] = [
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
    area: 'Site',
    items: [
      'Model Eldridge Coast companions as equipment loadouts',
      'Condition + uses tracking for drone loadout items',
    ],
  },
  {
    date: '2026-07-04',
    title: 'Crawler bays',
    area: 'Site',
    items: ['One Crawler Bay type; homebrew bays grouped underneath'],
  },
]

/** The release list — each entry a paper panel with an area badge. */
export const Default: Story = () => (
  <div className="flex max-w-2xl flex-col gap-3">
    <Caption>
      Release entries, newest first — version/title headline, area badge, date, items.
    </Caption>
    <Changelog entries={ENTRIES} />
  </div>
)

/** The empty state (no releases yet). */
export const Empty: Story = () => (
  <div className="max-w-2xl">
    <Changelog entries={[]} />
  </div>
)
