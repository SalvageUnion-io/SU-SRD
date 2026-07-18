import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Caption } from '../_harness'

/**
 * L1 "before" capture — the hand-rolled `bg-ink … font-cond uppercase … text-paper`
 * ink-stamp markup scattered across ITUN's sheet + roster surfaces. Every row
 * below is copied VERBATIM from its ITUN source (className + DOM), so it renders
 * identically to production. They all duplicate `Badge shape="stamp"`.
 */

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Ink Stamp Labels' }

export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const klass = SalvageUnionReference.Classes.all()[0]
  if (!chassis || !klass) return <Caption>Reference data missing</Caption>

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Caption>
          SheetSectionCard CARD_TITLE_STAMP (SheetSectionCard.tsx:30) — card-title stamp ·
          duplicates Badge shape="stamp"
        </Caption>
        {/* CARD_TITLE_STAMP, copied verbatim */}
        <span className="box-decoration-clone inline bg-ink px-2 pb-[3px] pt-[2px] font-cond text-sm font-bold uppercase leading-relaxed tracking-caps text-paper">
          Pilot Abilities
        </span>
      </div>

      <div>
        <Caption>
          LiveSheet BARNAME_STAMP_CLASS (LiveSheet.tsx:142) — top-bar name stamp · duplicates Badge
          shape="stamp"
        </Caption>
        {/* BARNAME_STAMP_CLASS, copied verbatim */}
        <span className="block max-w-full truncate bg-ink px-2 pb-[3px] pt-[2px] font-cond text-[15px] font-bold uppercase leading-[1.5] tracking-[0.045em] text-paper">
          {chassis.name}
        </span>
      </div>

      <div>
        <Caption>
          EntityListItem name stamp (EntityListItem.tsx:102) — list-item name stamp · duplicates
          Badge shape="stamp"
        </Caption>
        {/* EntityListItem name stamp, copied verbatim */}
        <span className="inline-block max-w-full truncate align-middle rounded-[1px] bg-ink px-1.5 py-0.5 font-cond text-[15px] font-bold uppercase leading-tight tracking-[0.02em] text-paper">
          {klass.name}
        </span>
      </div>

      <div>
        <Caption>
          SheetHero category tab + name stamp (SheetHero.tsx:82, :91) — seam placement, overhang the
          frame · duplicates Badge shape="stamp"
        </Caption>
        {/* SheetHero section frame + tone, so the overhanging stamps read as the "seam" */}
        <section
          className="sheet--mech relative overflow-hidden rounded-[3px] border-entity border-ink"
          style={{ background: 'var(--tone)' }}
        >
          {/* Category tab — overhangs the top border like .ec__cat (SheetHero.tsx:82) */}
          <span className="absolute -top-px left-[18px] bg-ink px-[7px] pb-px pt-[2px] font-cond text-badge font-semibold uppercase leading-none tracking-caps-snug text-paper">
            Mech Chassis
          </span>
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
