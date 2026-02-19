const ACTION_BUTTON_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-su-black font-mono font-semibold uppercase text-su-white transition-colors disabled:pointer-events-none disabled:opacity-50'

const SIZE_FULL = 'px-3 py-1.5 text-sm'
const SIZE_COMPACT = 'px-2 py-1 text-xs'

const COLOR_MAP = {
  green: 'bg-su-green hover:bg-emerald-600',
  rust: 'bg-su-rust hover:bg-red-700',
  orange: 'bg-su-orange hover:bg-orange-700',
} as const

export function actionButtonClasses(color: 'green' | 'rust' | 'orange', compact?: boolean): string {
  return `${ACTION_BUTTON_BASE} ${compact ? SIZE_COMPACT : SIZE_FULL} ${COLOR_MAP[color]}`
}
