import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Stepper } from './Stepper'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Stepper',
}

/** Gauge-story caption: names the variant / prop above each cluster. */
function Label({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
      {children}
    </div>
  )
}

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/**
 * `Stepper` — the vertical wizard nav rail. Zero-padded numbers, done steps in
 * ink, active step bold with the inset rust bar. Static (no nav) vs clickable
 * back-nav.
 */
export const Default: Story = () => {
  const steps = ['Class', 'Chassis', 'Systems', 'Modules', 'Cargo', 'Review']
  return (
    <div className="bg-paper p-4">
      <div className="flex flex-wrap gap-8">
        <Cluster label="active mid-wizard (static)">
          <Stepper steps={steps} active={2} className="w-48" />
        </Cluster>
        <Cluster label="clickable back-nav (onStepClick)">
          <Stepper steps={steps} active={3} onStepClick={() => {}} className="w-48" />
        </Cluster>
      </div>
    </div>
  )
}
