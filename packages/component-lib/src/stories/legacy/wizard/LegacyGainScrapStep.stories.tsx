import type { Story } from '@ladle/react'
import { MECH_CREATION_SCRAP_CAP } from 'salvageunion-reference/rules'
import { Stat } from '../../../components/shared/Stat'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mech Gain Scrap Step' }

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/mech/GainScrapStep.tsx (lines 10-20):
 * a single compact SCRAP Stat beside a max-52ch briefing paragraph. Display
 * only — nothing to choose. `MECH_CREATION_SCRAP_CAP` (20) is the real rule
 * constant, imported from the reference package.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Gain Scrap step (ITUN GainScrapStep, lines 10-20)</Caption>

    <div className="flex flex-wrap items-start gap-4">
      <Stat label="SCRAP" value={MECH_CREATION_SCRAP_CAP} max={MECH_CREATION_SCRAP_CAP} compact />
      <p className="m-0 max-w-[52ch] self-center font-body text-sm leading-relaxed text-current">
        Every purchase in this workshop — the Chassis, each System, each Module — debits this one
        pool. Whatever is left over banks to your Union Crawler when the build is done.
      </p>
    </div>
  </div>
)
