import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'

import { StatLine } from './StatLine'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Stat Line',
}

/**
 * StatLine — vitals as inline running text, the rail-body form.
 *
 * Deliberately NOT pips: the rail is specified as numeric text, so `StatLine`
 * and `Stat`/`StatsBar` are different jobs. What it collapses is the mech /
 * pilot / crawler triplication that each hand-wrote this same markup.
 *
 * The values below are the real vitals each sheet rail shows.
 */
export const Default: Story = () => (
  <div className="max-w-md space-y-5 font-body text-sm text-ink">
    <div className="space-y-1">
      <Caption>mech · SP / EP / Heat</Caption>
      <StatLine
        items={[
          { label: 'SP', value: 9, max: 13 },
          { label: 'EP', value: 6, max: 11 },
          { label: 'Heat', value: 4, max: 12 },
        ]}
      />
    </div>

    <div className="space-y-1">
      <Caption>pilot · HP / AP</Caption>
      <StatLine
        items={[
          { label: 'HP', value: 7, max: 10 },
          { label: 'AP', value: 4, max: 6 },
        ]}
      />
    </div>

    <div className="space-y-1">
      <Caption>crawler · SP + a suffixed count</Caption>
      <StatLine
        items={[
          { label: 'SP', value: 9, max: 13 },
          { label: 'Bays', value: 4, max: 5, suffix: 'Intact' },
        ]}
      />
    </div>

    <div className="space-y-1">
      <Caption>single item · no separator</Caption>
      <StatLine items={[{ label: 'SP', value: 20, max: 25 }]} />
    </div>
  </div>
)
