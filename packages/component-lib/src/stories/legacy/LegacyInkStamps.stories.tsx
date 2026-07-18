import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Caption } from '../_harness'

/**
 * L1 "before" capture — the ONE remaining hand-rolled ink stamp after the
 * Ink-Stamp-Labels reconciliation. The four label/tab stamps (SheetSectionCard
 * card title, LiveSheet bar name, EntityListItem row name, SheetHero category
 * tab) now route through `Badge shape="stamp"`.
 *
 * This hero title is the open case: it is a display HEADLINE (26–31px, wraps to
 * multiple lines with `box-decoration-clone` + `leading-[1.28]`), not a label.
 * `Badge shape="stamp"` intentionally hard-sets `line-height: 1` for crisp
 * single-line labels/tabs, which would cramp a wrapped hero name — so converting
 * it needs a Badge line-height escape hatch, not a like-for-like swap.
 */

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Ink Stamp Labels' }

export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  if (!chassis) return <Caption>Reference data missing</Caption>

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Caption>
          SheetHero name stamp (SheetHero.tsx:91) — hero HEADLINE, wraps at 26/31px · needs a Badge
          line-height escape before it can adopt shape="stamp"
        </Caption>
        {/* SheetHero section frame + tone, so the overhanging name reads in situ */}
        <section
          className="sheet--mech relative overflow-hidden rounded-[3px] border-entity border-ink"
          style={{ background: 'var(--tone)' }}
        >
          <div className="flex flex-col gap-[18px] px-4 py-[18px] sm:px-5">
            <div className="min-w-0">
              {/* Name stamp (SheetHero.tsx:91) */}
              <h1 className="m-0 inline bg-ink box-decoration-clone px-2 font-cond text-[26px] font-bold uppercase leading-[1.28] text-paper sm:text-[31px]">
                {chassis.name}
              </h1>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
