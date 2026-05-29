import { useEffect, useMemo, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefSystem } from 'salvageunion-reference'

import { useEntityStore } from '../../stores/entityStore'
import { CrawlerSchema } from '../../lib/schemas/crawler'
import { computeCrawlerCapacity } from '../../lib/rules/crawlerCapacity'
import { Button } from '../ui/button'
import { BaysEditor } from './BaysEditor'
import { SystemsList } from './SystemsList'
import { TechLevelSelector } from './TechLevelSelector'

type CrawlerBuilderProps = {
  /** Called after the crawler is successfully created. */
  onCreated: () => void
  /** Called when the user wants to cancel / go back. */
  onCancel: () => void
}

type FormState = {
  name: string
  techLevel: number | null
  bays: string[]
  systems: string[]
}

const INITIAL_STATE: FormState = {
  name: '',
  techLevel: null,
  bays: [],
  systems: [],
}

/**
 * Returns systems whose numeric techLevel <= the crawler's selected TL.
 * Systems with non-numeric TL (Bio/Nanite) are excluded from TL filtering.
 */
function filterSystemsByTL(allSystems: SURefSystem[], tl: number | null): SURefSystem[] {
  if (tl === null) return []
  return allSystems.filter((s) => {
    if (typeof s.techLevel !== 'number') return false
    return s.techLevel <= tl
  })
}

export function CrawlerBuilder({ onCreated, onCancel }: CrawlerBuilderProps) {
  const [techLevels, setTechLevels] = useState<{ id: string; name: string; techLevel: number }[]>(
    []
  )
  const [allSystems, setAllSystems] = useState<SURefSystem[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void SalvageUnionReference.preload(['crawler-tech-levels', 'systems']).then(() => {
      const tls = SalvageUnionReference.CrawlerTechLevels.all()
      const sorted = [...tls].sort((a, b) => a.techLevel - b.techLevel)
      setTechLevels(sorted)
      setAllSystems(SalvageUnionReference.Systems.all())
    })
  }, [])

  const filteredSystems = filterSystemsByTL(allSystems, form.techLevel)

  // ---------------------------------------------------------------------------
  // Live capacity computation (soft-warn only — does NOT block submit)
  // ---------------------------------------------------------------------------
  const crawlerCapacity = useMemo(
    () =>
      computeCrawlerCapacity({
        techLevel: form.techLevel ?? 0,
        bays: form.bays,
        systems: form.systems,
      }),
    [form.techLevel, form.bays, form.systems]
  )

  const hasCapacityViolations =
    form.techLevel !== null &&
    crawlerCapacity.violations.some(
      (v) => v.kind === 'bays-over-capacity' || v.kind === 'systems-over-capacity'
    )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.techLevel) {
      setError('Please select a tech level.')
      return
    }
    if (!form.name.trim()) {
      setError('Please enter a crawler name.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const rawInput = {
        schemaVersion: 1 as const,
        name: form.name.trim(),
        techLevel: `tech-${form.techLevel}`,
        bays: form.bays,
        systems: form.systems,
      }

      // Validate against CrawlerSchema before submitting (surface errors in-UI)
      const validation = CrawlerSchema.safeParse({
        ...rawInput,
        id: 'temp-validate-only',
        createdAt: now,
        updatedAt: now,
      })
      if (!validation.success) {
        const messages = validation.error.issues
          .map((e: { message: string }) => e.message)
          .join('; ')
        setError(`Validation error: ${messages}`)
        setIsSubmitting(false)
        return
      }

      // The db layer injects id, createdAt, updatedAt — pass only the user data.
      await useEntityStore.getState().create('crawler', rawInput)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create crawler.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="crawler-name" className="mb-1 block text-sm font-semibold">
          Crawler Name
        </label>
        <input
          id="crawler-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="The Wandering Throne"
          required
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <TechLevelSelector
        techLevels={techLevels}
        selectedTechLevel={form.techLevel}
        onChange={(tl) => setForm((f) => ({ ...f, techLevel: tl, systems: [] }))}
      />

      <BaysEditor bays={form.bays} onChange={(bays) => setForm((f) => ({ ...f, bays }))} />

      <SystemsList
        systems={filteredSystems}
        selectedSystemSlugs={form.systems}
        onChange={(systems) => setForm((f) => ({ ...f, systems }))}
      />

      {/* Auto stand-in pilots preview */}
      <div
        className="rounded border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-sm text-muted-foreground"
        aria-label="Pilot roster placeholder"
      >
        [No Pilots Assigned] — pilot assignment available after Wave 3 soft-wiring (story #195)
      </div>

      {/* Capacity banner — soft warning only, does NOT block submit */}
      {hasCapacityViolations && (
        <div
          role="region"
          aria-label="Capacity warning"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
        >
          <strong>Capacity warning</strong> — this crawler exceeds its tech-level caps (bays:{' '}
          {crawlerCapacity.baysUsed}/{crawlerCapacity.baysMax}, systems:{' '}
          {crawlerCapacity.systemsUsed}/{crawlerCapacity.systemsMax}). You can still save — review
          before proceeding.
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Crawler'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
