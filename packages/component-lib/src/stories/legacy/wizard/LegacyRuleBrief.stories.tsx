import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Badge, DisplayCard } from 'component-lib'
import { cn } from '../../../utils/cn'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Rule Brief' }

/**
 * Verbatim reproduction of the wizard "THE RULE" callout from
 * apps/in-the-union-now/src/components/wizard/RuleBrief.tsx, which composes the
 * app's SheetSectionCard (apps/in-the-union-now/src/components/sheet/SheetSectionCard.tsx).
 *
 * Both are inlined here (app components can't be imported): SheetSectionCard is
 * reproduced verbatim over the shared component-lib `DisplayCard` + `Badge`
 * atoms it actually composes, and RuleBrief wraps it. The `--tone` / `--tone-deep`
 * accent vars come from a `.sheet--{kind}` ancestor in the app; the story frames
 * each brief in a `sheet--pilot` / `sheet--mech` / `sheet--crawler` wrapper so
 * the poster accent bands render as they do in each wizard.
 */

// --- SheetSectionCard (verbatim from apps/.../sheet/SheetSectionCard.tsx) ---
type SheetSectionCardProps = {
  title: string
  count?: ReactNode
  controls?: ReactNode
  source?: ReactNode
  footChips?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

function SheetSectionCard({
  title,
  count,
  controls,
  source,
  footChips,
  className,
  bodyClassName,
  children,
}: SheetSectionCardProps) {
  return (
    <DisplayCard
      headerBg="bg-[var(--tone)]"
      borderColor="var(--tone)"
      cardStyle={{ className: cn('sheet-section', className) }}
      bodyPadding="p-0"
      headerContent={
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Badge shape="stamp" size="lg">
              {title}
            </Badge>
            {count}
          </div>
          {controls && <div className="ml-auto flex items-center gap-2">{controls}</div>}
        </>
      }
      footerContent={
        source ? (
          <span className="min-w-0 truncate font-cond text-[10px] font-semibold uppercase leading-none tracking-caps text-ink/85">
            {source}
          </span>
        ) : undefined
      }
      footActions={footChips}
    >
      <div className="flex flex-1 flex-col bg-[var(--tone)] px-3">
        <div
          className={cn(
            'flex-1 border-l-[3px] border-[var(--tone-deep)] bg-paper px-3.5 py-3',
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </DisplayCard>
  )
}

// --- RuleBrief (verbatim from apps/.../wizard/RuleBrief.tsx) ---
type StepRule = {
  rule: ReactNode
  cite?: string
}

function RuleBrief({ rule, cite, className }: StepRule & { className?: string }) {
  return (
    <section aria-label="The rule" className={className}>
      <SheetSectionCard title="The Rule" source={cite}>
        <p className="m-0 max-w-[70ch] font-body text-sm leading-relaxed text-ink">{rule}</p>
      </SheetSectionCard>
    </section>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-8">
    <Caption>
      Legacy · wizard "THE RULE" callout (ITUN RuleBrief → SheetSectionCard) — a black THE RULE
      Badge stamp in a var(--tone) header band, paraphrased rule text on paper behind the deep-tone
      left rule, Core Book citation in the accent footer. Real per-step rule + cite literals from
      PilotWizard / CrawlerBuilder.
    </Caption>

    {/* Pilot step — real rule copy from PilotWizard (Core Book · pp.18–19). */}
    <div className="sheet--pilot">
      <Caption>Pilot · Class step</Caption>
      <RuleBrief
        rule="Choose your pilot class and abilities — any class, any tree, any level. Specialisation prerequisites and rule caps warn on Review, never block."
        cite="Core Book · pp.18–19"
      />
    </div>

    {/* Pilot equipment step — real rule copy from PilotWizard. */}
    <div className="sheet--pilot">
      <Caption>Pilot · Equipment step</Caption>
      <RuleBrief
        rule="You may choose two pieces of Tech 1 Pilot Equipment from the list. Note these in your inventory. Most items fill 1 Inventory Slot; Heavy and Portable gear fills 2."
        cite="Core Book · p.19 · Pilot Equipment pp.78–87"
      />
    </div>

    {/* Crawler stats step — verbatim rule copy from CrawlerBuilder. */}
    <div className="sheet--crawler">
      <Caption>Crawler · Stats step</Caption>
      <RuleBrief
        rule="Your Crawler has a set of statistics based on its Tech Level. This includes its Structure Points, Upkeep, and Upgrade cost. Note these down on your Crawler Sheet."
        cite="Core Book · p.212 · Crawler Stats p.218"
      />
    </div>

    {/* Cite-less brief — the Review/create step (RuleBrief renders no footer). */}
    <div className="sheet--mech">
      <Caption>Mech · Review step (no citation → no footer band)</Caption>
      <RuleBrief rule="Check the build, then create." />
    </div>
  </div>
)
