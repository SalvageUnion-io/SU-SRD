import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { EmptyState } from '../../components/chrome/EmptyState'
import { OptRow } from '../../components/chrome/OptRow'
import { ClassAbilityTree } from '../../components/referenceEntity/ClassAbilityTree'
import { ReferenceEntityDisplay } from '../../components/referenceEntity/card/referenceEntityDisplayShim'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Pilot Class Step' }

// ── Mirror of ITUN's app-only classOptions helpers (cannot import from apps) ──

/** Base-class guard: only classes with a non-empty `coreTrees` field. */
function isBaseClass(cls: unknown): cls is SURefClass & { coreTrees: string[] } {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'coreTrees' in cls &&
    Array.isArray((cls as { coreTrees: unknown }).coreTrees) &&
    ((cls as { coreTrees: string[] }).coreTrees?.length ?? 0) > 0
  )
}

/** Advanced/Hybrid specialisation guard (advancedTree, no core trees). */
function isSpecialisationClass(cls: unknown): cls is SURefClass {
  return (
    typeof cls === 'object' &&
    cls !== null &&
    'advancedTree' in cls &&
    !isBaseClass(cls) &&
    'name' in cls
  )
}

/** First text content block — used as the OptRow description line. */
function classDescription(cls: SURefClass): string | undefined {
  const content = (cls as { content?: unknown }).content
  if (Array.isArray(content)) {
    const firstText = content.find(
      (b) =>
        typeof b === 'object' && b !== null && typeof (b as { text?: unknown }).text === 'string'
    ) as { text: string } | undefined
    return firstText?.text
  }
  return undefined
}

// ── Verbatim reproductions of ClassStep.tsx sub-parts ────────────────────────

/**
 * Verbatim reproduction of ClassOptionList
 * (apps/in-the-union-now/src/components/pilot/ClassStep.tsx lines 16-51):
 * OptRow per base class, with Advanced/Hybrid specialisations under their own
 * separator (edit mode).
 */
function ClassOptionList({
  base,
  specialisations,
  selectedClassId,
  onSelect,
}: {
  base: SURefClass[]
  specialisations: SURefClass[]
  selectedClassId: string
  onSelect: (classId: string) => void
}) {
  return (
    <div>
      {base.map((cls) => (
        <OptRow
          key={cls.id}
          name={cls.name}
          desc={classDescription(cls)}
          active={cls.id === selectedClassId}
          onClick={() => onSelect(cls.id)}
        />
      ))}
      {specialisations.length > 0 && (
        <>
          <p className="mb-2 mt-5 font-cond text-xs font-bold uppercase tracking-widest text-wk-muted">
            Advanced / Hybrid — requires 6 core abilities
          </p>
          {specialisations.map((cls) => (
            <OptRow
              key={cls.id}
              name={cls.name}
              desc={classDescription(cls)}
              active={cls.id === selectedClassId}
              onClick={() => onSelect(cls.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}

/**
 * Verbatim reproduction of ClassDetail (ClassStep.tsx lines 63-79): the
 * selected class's full entity card with its ability trees expanded inside.
 */
function ClassDetail({ selectedClass }: { selectedClass: SURefClass | undefined }) {
  if (!selectedClass) {
    return (
      <EmptyState
        className="h-full"
        headline="No Class Selected"
        body="Select a class to preview its ability trees."
      />
    )
  }
  return (
    <ReferenceEntityDisplay
      data={selectedClass as unknown as SURefEntity}
      afterExtraContent={<ClassAbilityTree classEntity={selectedClass} />}
    />
  )
}

/** Two-pane host mirroring how the wizard lays out the Class step. */
function LegacyClassStep({ includeSpecialisations }: { includeSpecialisations: boolean }) {
  const all = SalvageUnionReference.Classes.all()
  const base = all.filter(isBaseClass)
  const specialisations = includeSpecialisations ? all.filter(isSpecialisationClass) : []
  const [selectedClassId, setSelectedClassId] = useState('')
  const selectedClass = [...base, ...specialisations].find((c) => c.id === selectedClassId)

  if (base.length === 0) return <Caption>No classes in reference data.</Caption>

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,1fr)_1.4fr]">
      <ClassOptionList
        base={base}
        specialisations={specialisations}
        selectedClassId={selectedClassId}
        onSelect={setSelectedClassId}
      />
      <ClassDetail selectedClass={selectedClass} />
    </div>
  )
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Class step (ClassStep.tsx lines 16-79) — OptRow master list + ReferenceEntity
      detail with ClassAbilityTree. Click a class to preview its trees.
    </Caption>
    <LegacyClassStep includeSpecialisations={false} />
  </div>
)

export const EditMode: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Class step, edit mode — Advanced / Hybrid specialisations appear under their
      separator
    </Caption>
    <LegacyClassStep includeSpecialisations />
  </div>
)
