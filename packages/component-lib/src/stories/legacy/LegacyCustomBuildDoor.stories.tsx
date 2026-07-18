import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Sel } from '../../components/chrome/Sel'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Custom Build Door' }

/**
 * Verbatim reproduction of the "Custom build" option from
 * apps/in-the-union-now/src/components/mech/MechChassisStep.tsx (lines 148-168):
 * a bare <Sel> wrapping a dashed door, overriding Sel's native rust ring with a
 * bespoke double-ink halo (`shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]`)
 * only while selected.
 */
export const Default: Story = () => {
  const [isCustom, setIsCustom] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Legacy · Custom build door (ITUN MechChassisStep) — overrides Sel's native ring with a
        bespoke double-ink halo; a candidate Sel variant. Click to toggle.
      </Caption>

      <div className="max-w-xs">
        <Sel
          selected={isCustom}
          onToggle={() => setIsCustom((v) => !v)}
          ariaLabel="Custom build"
          radio
          className={
            isCustom ? 'shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]' : undefined
          }
        >
          <div className="rounded-[5px] border-2 border-dashed border-ink/55 bg-paper px-4 py-4">
            <p className="m-0 font-cond text-sm font-bold uppercase tracking-caps text-ink">
              Custom build
            </p>
            <p className="m-0 mt-1 font-body text-caption text-ink-2">
              No prefill — craft your Systems and Modules by hand in the next steps.
            </p>
          </div>
        </Sel>
      </div>
    </div>
  )
}
