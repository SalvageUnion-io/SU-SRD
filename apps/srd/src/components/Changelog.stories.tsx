import { space } from 'component-lib/design/tokens'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import type { ChangelogEntry } from './Changelog'
import { Changelog } from './Changelog'

export default { title: 'Compositions/Changelog' }

/** The changelog's 42rem measure. */
const STAGE = { maxWidth: '42rem' } satisfies CSSProperties

// Real-shaped entries (one per day, newest first) as `gitChangelog.ts` reads
// them from a site's scoped squash titles.
const ENTRIES: ChangelogEntry[] = [
  {
    date: '2026-07-18',
    area: 'Site',
    items: [
      'Add a Ko-fi support link and a new In the Union Now About page ([#401](https://github.com/SalvageUnion-io/SU-SRD/pull/401))',
      'Derive the changelog from conventional-commit PR titles ([#398](https://github.com/SalvageUnion-io/SU-SRD/pull/398))',
    ],
  },
  {
    date: '2026-07-12',
    area: 'Site',
    items: ['Model Eldridge Coast companions as equipment loadouts'],
  },
  {
    date: '2026-07-04',
    area: 'Site',
    items: ['One Crawler Bay type; homebrew bays grouped underneath'],
  },
]

/** The history — each day a paper panel with an area badge. */
export const Default: Story = () => (
  <div style={{ ...STAGE, display: 'flex', flexDirection: 'column', gap: space[12] }}>
    <Caption>One entry per day, newest first — date headline, area badge, items.</Caption>
    <Changelog entries={ENTRIES} />
  </div>
)

/** The empty state (no history yet). */
export const Empty: Story = () => (
  <div style={STAGE}>
    <Changelog entries={[]} />
  </div>
)
