import { useEffect, useState } from 'react'

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefSystem } from 'salvageunion-reference'

import { useEntityStore } from '../../stores/entityStore'
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
      // The db layer injects id, createdAt, updatedAt — pass only the user data.
      await useEntityStore.getState().create('crawler', {
        schemaVersion: 1 as const,
        name: form.name.trim(),
        techLevel: `tech-${form.techLevel}`,
        bays: form.bays,
        systems: form.systems,
      })
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

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Create Crawler'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
