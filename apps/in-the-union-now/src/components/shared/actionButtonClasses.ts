const ACTION_BUTTON_BASE =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors disabled:pointer-events-none disabled:opacity-50'

const COLOR_MAP = {
  green: `${ACTION_BUTTON_BASE} bg-su-green hover:bg-emerald-600`,
  rust: `${ACTION_BUTTON_BASE} bg-su-rust hover:bg-red-700`,
  orange: `${ACTION_BUTTON_BASE} bg-su-orange hover:bg-orange-700`,
} as const

export function actionButtonClasses(color: 'green' | 'rust' | 'orange'): string {
  return COLOR_MAP[color]
}
