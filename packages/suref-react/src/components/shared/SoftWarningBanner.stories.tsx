import type { Story } from '@ladle/react'
import { SoftWarningBanner, type SoftWarning } from './SoftWarningBanner'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ITUN/Soft Warning Banner',
}

const warnings: SoftWarning[] = [
  { code: 'over-cargo', severity: 'warn', message: 'Your Hold exceeds its Cargo Cap by 2 lots.' },
  { code: 'no-weapon', severity: 'info', message: 'This Mech has no equipped weapon.' },
]

/**
 * Advisory, non-blocking soft-warnings (lifted from ITUN, pending review — it
 * overlaps `Banner`; a merge is a later migration call). Passive (info only,
 * no actions) vs the confirm variant with Save anyway / Fix it.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <SoftWarningBanner warnings={warnings} />
    <SoftWarningBanner warnings={warnings} onSaveAnyway={() => {}} onFixIt={() => {}} />
  </div>
)
