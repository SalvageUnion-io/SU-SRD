/**
 * PilotIdentityLines — the pilot hero's identity-lines block (design §4.2)
 * with the three once-per-Downtime 'Used' toggles (rules A8–A10) rendered as
 * Tag/chip toggles on the Background / Motto / Keepsake lines.
 *
 * Markup mirrors SheetHero's identity dl (the shell stays untouched — this
 * slots into the hero's spec strip; see needsSharedChange for the proposed
 * per-line chip slot on SheetHero). Empty-value lines are skipped, matching
 * the shell's behavior.
 *
 * readOnly (no onToggleUsed): chips render as static 'USED' stamps, and only
 * when the flag is set.
 */

import { cn } from '../../lib/utils'
import type { Pilot } from '../../lib/schemas/pilot'

export type UsedToggleKey = 'background' | 'motto' | 'keepsake'

type IdentityLine = {
  key: string
  label: string
  value: string
  /** Present only on the three once-per-Downtime lines. */
  toggle?: UsedToggleKey
}

type PilotIdentityLinesProps = {
  pilot: Pilot
  /** Persist a used-flag change; omit to render read-only. */
  onToggleUsed?: (key: UsedToggleKey, next: boolean) => void
  className?: string
}

function UsedChip({
  label,
  used,
  onToggle,
}: {
  label: string
  used: boolean
  onToggle?: (next: boolean) => void
}) {
  const base =
    'inline-flex items-center rounded-[2px] px-[7px] pb-[1px] pt-[2px] font-cond text-[10px] font-semibold uppercase leading-tight tracking-[0.06em]'
  if (!onToggle) {
    if (!used) return null
    return <span className={cn(base, 'bg-ink text-paper')}>Used</span>
  }
  return (
    <button
      type="button"
      aria-pressed={used}
      aria-label={used ? `Reset ${label} used` : `Mark ${label} used`}
      onClick={() => onToggle(!used)}
      className={cn(
        base,
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40',
        used
          ? 'bg-ink text-paper'
          : 'border border-dashed border-ink/50 bg-transparent text-ink/70 hover:border-ink hover:text-ink'
      )}
    >
      Used
    </button>
  )
}

export function PilotIdentityLines({ pilot, onToggleUsed, className }: PilotIdentityLinesProps) {
  const allLines: IdentityLine[] = [
    {
      key: 'background',
      label: 'Background',
      value: pilot.background,
      toggle: 'background',
    },
    { key: 'motto', label: 'Motto', value: pilot.motto, toggle: 'motto' },
    {
      key: 'keepsake',
      label: 'Keepsake',
      value: pilot.keepsake,
      toggle: 'keepsake',
    },
    { key: 'appearance', label: 'Appearance', value: pilot.appearance },
  ]
  const lines = allLines.filter((line) => line.value.trim().length > 0)

  if (lines.length === 0) return null

  return (
    <dl className={cn('w-full space-y-1', className)}>
      {lines.map((line) => (
        <div key={line.key} className="flex items-baseline gap-1.5">
          <dt className="shrink-0 font-cond text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-ink">
            {line.label}
          </dt>
          <dd
            className="m-0 min-w-0 font-body text-xs leading-snug"
            style={{ color: 'var(--tone-deep)' }}
          >
            {line.value}
          </dd>
          {line.toggle && (
            <UsedChip
              label={line.label.toLowerCase()}
              used={pilot.usedToggles?.[line.toggle] ?? false}
              onToggle={
                onToggleUsed
                  ? (next) => {
                      onToggleUsed(line.toggle as UsedToggleKey, next)
                    }
                  : undefined
              }
            />
          )}
        </div>
      ))}
    </dl>
  )
}
