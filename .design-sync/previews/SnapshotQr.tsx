/* Ported from packages/component-lib/src/components/sheet/SnapshotQr.stories.tsx. */
import { SnapshotQr } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * Encodes a share URL locally — no network call and no external image service,
 * which is why a shared snapshot link can be handed across a table offline.
 */
export function ShareCode() {
  return (
    <div className="bg-paper p-4">
      <Caption>a snapshot share URL, encoded in the browser</Caption>
      <SnapshotQr url="https://intheunionnow.com/s/example-snapshot" />
    </div>
  )
}
