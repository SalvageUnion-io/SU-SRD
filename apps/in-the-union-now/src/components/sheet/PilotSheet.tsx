/**
 * PilotSheet — read-only pilot section for the sheet view.
 *
 * Renders: callsign + name + class ref, abilities, equipment (with read-only
 * ConditionToggle), and identity fields (motto, keepsake, appearance).
 *
 * ConditionToggle is rendered in display-only mode: the onChange handler is a
 * no-op, so clicks have no effect.
 */

import type { Pilot } from '../../lib/schemas/pilot'
import { ConditionToggle } from '../shared/ConditionToggle'

type PilotSheetProps = {
  pilot: Pilot
}

export function PilotSheet({ pilot }: PilotSheetProps) {
  return (
    <section aria-labelledby="pilot-sheet-heading" className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 id="pilot-sheet-heading" className="text-xl font-bold">
          {pilot.callsign ? `"${pilot.callsign}" ` : ''}
          {pilot.name}
        </h2>
        <p className="text-sm text-muted-foreground">Class: {pilot.classRef}</p>
      </div>

      {/* Abilities */}
      {pilot.abilities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Abilities
          </h3>
          <ul className="flex flex-col gap-1">
            {pilot.abilities.map((slug) => (
              <li key={slug} className="text-sm rounded border border-border px-2 py-1">
                {slug}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Equipment */}
      {pilot.equipment.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Equipment
          </h3>
          <ul className="flex flex-col gap-1">
            {pilot.equipment.map((slug) => (
              <li
                key={slug}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm"
              >
                <span>{slug}</span>
                {/* Read-only condition display — onChange is a no-op */}
                <ConditionToggle value="intact" onChange={() => undefined} ariaLabelPrefix={slug} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Identity */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h3>
        {pilot.motto && (
          <p className="text-sm">
            <span className="font-medium">Motto:</span> {pilot.motto}
          </p>
        )}
        {pilot.keepsake && (
          <p className="text-sm">
            <span className="font-medium">Keepsake:</span> {pilot.keepsake}
          </p>
        )}
        {pilot.appearance && (
          <p className="text-sm">
            <span className="font-medium">Appearance:</span> {pilot.appearance}
          </p>
        )}
      </div>
    </section>
  )
}
