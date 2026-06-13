import { cn } from '../../utils/cn'

/** Per-item condition vocabulary (rules: Intact / Damaged / Destroyed). */
export type EntityStatus = 'intact' | 'damaged' | 'destroyed'

const STATUS_STYLES: Record<EntityStatus, { label: string; className: string }> = {
  intact: { label: 'Intact', className: 'bg-status-ok' },
  damaged: { label: 'Damaged', className: 'bg-status-warn' },
  destroyed: { label: 'Destroyed', className: 'bg-status-bad' },
}

type StatusBadgeProps = {
  status: EntityStatus
  /** Cycle handler (Intact → Damaged → Destroyed → Intact) */
  onClick?: () => void
  /**
   * Entity name for the accessible label ("<subject> status: <Label>") so
   * multiple badges on one page get distinct accessible names. Without it
   * the label is the generic "Status: <Label>".
   */
  subject?: string
  className?: string
}

/**
 * Entity status badge (design-spec §2.1 `.ec__status`): 2px ink frame,
 * status-colored fill, uppercase cond label. Clickable when a cycle handler
 * is provided.
 */
export function StatusBadge({ status, onClick, subject, className }: StatusBadgeProps) {
  const { label, className: fill } = STATUS_STYLES[status]
  const shared = cn(
    'inline-flex items-center rounded-[2px] border-2 border-ink px-[9px] py-[3px] font-cond text-[11px] font-semibold uppercase leading-none text-su-white',
    fill,
    className
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={
          subject
            ? `${subject} status: ${label} — click to change`
            : `Status: ${label} — click to change`
        }
        className={cn(shared, 'cursor-pointer')}
      >
        {label}
      </button>
    )
  }
  return <span className={shared}>{label}</span>
}
