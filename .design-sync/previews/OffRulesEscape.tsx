/* Ported from packages/component-lib/src/components/shared/OffRulesEscape.stories.tsx. */
import { OffRulesEscape } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * The in-wizard exit to the Free-Edit Live Sheet — a dotted-underline text
 * button shown in the WizShell action pill while a gate is blocking. Rendered on
 * ink, which is where its `text-paper/70` treatment belongs.
 */
export function InPill() {
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <Caption>subordinate escape hatch — shown only while a gate blocks the build</Caption>
      <div className="w-fit rounded bg-ink px-4 py-3">
        <OffRulesEscape onEscape={() => {}} />
      </div>
    </div>
  )
}
