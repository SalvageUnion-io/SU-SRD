/* Ported from packages/component-lib/src/components/chrome/KvRow.stories.tsx. */
import { KvRow } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * The review-recap definition list — a fixed label rail against the value.
 * An empty value renders the muted "required" placeholder, and the last row
 * self-clears its rule.
 */
export function BuildRecap() {
  return (
    <div className="max-w-md bg-paper p-8">
      <Caption>build recap — filled rows, then two the pilot still owes</Caption>
      <div className="mt-3">
        <KvRow label="Callsign" value="Ace" />
        <KvRow label="Class" value="Salvager" />
        <KvRow label="Motto" value="Nothing stays buried." />
        <KvRow label="Appearance" value={null} />
        <KvRow label="Keepsake" value={undefined} />
      </div>
    </div>
  )
}
