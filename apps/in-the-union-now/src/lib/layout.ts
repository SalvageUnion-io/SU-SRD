/**
 * Shared layout constants (design review T-5).
 *
 * The fixed rail/pane widths that shape ITUN's shell layouts, named in one
 * place instead of magic `w-[Npx]` values scattered across components.
 *
 * Each constant is a COMPLETE literal Tailwind class string (responsive
 * prefix included) — Tailwind's source scanner picks class candidates out of
 * this file, so the values must never be built via string interpolation.
 * Compose them into `className` via `cn(...)`.
 */
export const LAYOUT = {
  /** WizShell left stepper rail — fixed 196px column at `lg+`. */
  stepperRail: 'lg:w-[196px]',
  /** WizShell optional option pane — fixed 320px column at `lg+`. */
  optionPane: 'lg:w-[320px]',
  /** Erow rail mode — content column + fixed 152px stat rail at `sm+`. */
  erowGrid: 'sm:grid-cols-[1fr_152px]',
  /** Minimum entity-card width before wrapping (Erow card + rail modes). */
  cardMin: 'min-w-[min(340px,100%)]',
  /** Wizard review-step label rail (pilot / mech / crawler review tables). */
  reviewLabelRail: 'w-[120px]',
} as const
