import { Badge, EmptyState, MasonryColumns, ReferenceEntityCard } from 'component-lib'
import { useMemo, useState } from 'react'
import { byTechLevelThenName, SalvageUnionReference } from 'salvageunion-reference'
import { matchesRef } from 'salvageunion-reference/rules'
import type { TechLevel } from '../../lib/rules/types'

const ALL_TLS: TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

type InstallStepProps = {
  /** Which dataset this step installs from. */
  kind: 'systems' | 'modules'
  /** Slug refs currently installed (may contain duplicates). */
  selected: string[]
  /** Append one copy of the named entity. */
  onAdd: (name: string) => void
}

/**
 * Install Systems / Install Modules step (design §3.2 mech wizard — NOT the
 * master-detail skeleton): the full-width catalog — TL filter chips over a
 * row-major 2-col grid of compact entity cards with a native `+ Add` affordance.
 * The 'Loadout · {name}' HUD is no longer part of this step: it now rides the
 * shared WizShell footer bar (MechWizard passes it as `footerHud`, mounted
 * alongside the nav buttons). Selection is never blocked — over-capacity shows
 * honestly in the footer's budget gauges (capacity stays soft, plan 3.4).
 */
export function InstallStep({ kind, selected, onAdd }: InstallStepProps) {
  const [activeTls, setActiveTls] = useState<TechLevel[]>([])

  const allItems = useMemo(() => {
    const accessor =
      kind === 'systems' ? SalvageUnionReference.Systems : SalvageUnionReference.Modules
    const items = accessor.all()
    return [...items].sort((a, b) => byTechLevelThenName(a, b))
  }, [kind])

  const visible =
    activeTls.length === 0
      ? allItems
      : allItems.filter((i) => activeTls.some((t) => t === i.techLevel))

  function toggleTl(tl: TechLevel) {
    setActiveTls((prev) => (prev.includes(tl) ? prev.filter((t) => t !== tl) : [...prev, tl]))
  }

  return (
    <div className="min-w-0">
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would need a legend and carries min-content sizing quirks in this flex chip row; role="group" + aria-label conveys the same semantics */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tech level">
        {ALL_TLS.map((tl) => (
          <Badge
            key={tl}
            shape="chip"
            as="button"
            aria-pressed={activeTls.includes(tl)}
            surface={activeTls.includes(tl) ? 'solid' : 'ghost'}
            swatch={`var(--color-tl-${typeof tl === 'number' ? tl : tl.toLowerCase()})`}
            onClick={() => toggleTl(tl)}
          >
            {typeof tl === 'number' ? `TL${tl}` : tl === 'B' ? 'Bio' : 'Nanite'}
          </Badge>
        ))}
      </div>

      <div className="mt-6">
        <MasonryColumns maxColumns={2}>
          {visible.map((item) => {
            const count = selected.filter((ref) => matchesRef(item, ref)).length
            const installed = count > 0
            // Count-based adder (duplicates are rules-legal; removal lives in
            // the Loadout panel): the card's `selected` ring marks "installed"
            // and the add rides the standard ReferenceEntity `controls` API —
            // the install count shows as the control's secondary segment.
            return (
              <ReferenceEntityCard
                key={item.id}
                data={item}
                size="medium"
                selected={installed}
                hide={{ actions: true, choices: true }}
                controls={[
                  {
                    key: 'add',
                    label: installed ? '+ Add another' : '+ Add',
                    segmentText: installed ? String(count) : undefined,
                    ariaLabel: `Add ${item.name}`,
                    onClick: () => onAdd(item.name),
                  },
                ]}
              />
            )
          })}
        </MasonryColumns>
      </div>
      {visible.length === 0 && (
        <EmptyState
          variant="quiet"
          className="mt-4"
          body={`No ${kind} at the selected tech levels.`}
        />
      )}
    </div>
  )
}
