import type { Story } from '@ladle/react'
import { Toaster, toast } from './toaster'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Toast',
}

// Ruleset §Toast: an off-white chip — status swatch + message + rust dismiss.
// Each button below fires a real `toast(...)` so the container is interactive.

const CAPTION = 'font-cond text-label uppercase tracking-caps text-wk-muted'

export const Default: Story = () => (
  <>
    <Toaster />
    <div className="flex flex-col gap-3">
      <span className={CAPTION}>
        status swatch + message + rust dismiss · fires a real toast, bottom-right
      </span>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-card bg-status-ok px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          onClick={() =>
            toast.success('Saved to workspace.', {
              description: 'Your build is up to date.',
            })
          }
        >
          Success
        </button>
        <button
          type="button"
          className="rounded-card bg-status-bad px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          onClick={() =>
            toast.error('Save failed.', {
              description: 'Could not reach local storage.',
            })
          }
        >
          Error
        </button>
        <button
          type="button"
          className="rounded-card bg-ink px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          onClick={() => toast('Nothing to report.')}
        >
          Default
        </button>
      </div>
    </div>
  </>
)

export const Dismiss: Story = () => (
  <>
    <Toaster />
    <div className="flex flex-col gap-3">
      <span className={CAPTION}>
        rust = the dismiss action · raise a sticky toast, then clear it
      </span>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-card bg-ink px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          onClick={() =>
            toast('Salvage pending…', {
              description: 'This chip stays until dismissed.',
              duration: Number.POSITIVE_INFINITY,
            })
          }
        >
          Raise sticky
        </button>
        <button
          type="button"
          className="rounded-card bg-rust px-4 py-2 font-cond uppercase tracking-caps-tight text-paper"
          onClick={() => toast.dismiss()}
        >
          Dismiss
        </button>
      </div>
    </div>
  </>
)
