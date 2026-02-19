const ACTION_BUTTON_BASE =
  'inline-flex cursor-pointer items-center font-mono font-semibold uppercase text-su-white transition-colors disabled:pointer-events-none disabled:opacity-50'

const BORDER = 'border border-su-black'
const SIZE_FULL = 'gap-1.5 rounded-md px-3 py-1.5 text-sm'
const SIZE_COMPACT = 'gap-1 px-1.5 py-0.5 text-xs leading-none'

const COLOR_MAP = {
  green: 'bg-su-green hover:bg-emerald-600',
  rust: 'bg-su-rust hover:bg-red-700',
  orange: 'bg-su-orange hover:bg-orange-700',
} as const

export function actionButtonClasses(
  color: 'green' | 'rust' | 'orange',
  compact?: boolean,
  options?: { noBorder?: boolean }
): string {
  const border = options?.noBorder ? '' : BORDER
  return `${ACTION_BUTTON_BASE} ${border} ${compact ? SIZE_COMPACT : SIZE_FULL} ${COLOR_MAP[color]}`
}
