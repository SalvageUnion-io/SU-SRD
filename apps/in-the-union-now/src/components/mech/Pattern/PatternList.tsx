/**
 * PatternList — lists all saved MechPatterns from the mechPatterns db store.
 *
 * Each pattern row shows its name, chassisRef, and slot counts, along with an
 * InstantiateFromPattern button.
 *
 * Data fetching: reads directly from db.mechPatterns (no entityStore layer for
 * patterns — patterns are a simple local store without the Zustand hydration
 * complexity). This keeps the component self-contained.
 *
 * onInstantiated is forwarded from the route so navigation can happen at the
 * route boundary.
 */

import { useEffect, useState } from 'react'
import * as db from '../../../lib/db/index'
import type { MechPattern } from '../../../lib/schemas/pattern'
import { InstantiateFromPattern } from './InstantiateFromPattern'

type PatternListProps = {
  /** Called with the new mech id when a pattern is instantiated. */
  onInstantiated: (mechId: string) => void
}

export function PatternList({ onInstantiated }: PatternListProps) {
  const [patterns, setPatterns] = useState<MechPattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    db.mechPatterns
      .list()
      .then((results) => {
        if (!cancelled) {
          setPatterns(results)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load patterns.')
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleInstantiated(mechId: string) {
    onInstantiated(mechId)
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Loading patterns…
      </p>
    )
  }

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No patterns saved yet. Use &ldquo;Save as pattern&rdquo; from the mech builder to save a
          reusable template.
        </p>
      </div>
    )
  }

  return (
    <ul
      className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      aria-label="Saved mech patterns"
    >
      {patterns.map((pattern) => (
        <li
          key={pattern.id}
          className="rounded-md border border-border p-4 flex items-start justify-between gap-4"
          data-testid="pattern-list-item"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-sm truncate">{pattern.name}</span>
            <span className="text-xs text-muted-foreground">
              Chassis: {pattern.chassisRef} &mdash; {pattern.systems.length} system
              {pattern.systems.length !== 1 ? 's' : ''}, {pattern.modules.length} module
              {pattern.modules.length !== 1 ? 's' : ''}, {pattern.cargo.length} cargo
            </span>
          </div>
          <InstantiateFromPattern pattern={pattern} onSuccess={handleInstantiated} />
        </li>
      ))}
    </ul>
  )
}
