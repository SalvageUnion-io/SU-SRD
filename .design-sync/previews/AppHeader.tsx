/* Ported from packages/component-lib/src/components/shared/AppHeader.stories.tsx. */
import { AppHeader } from 'component-lib'
import { Caption } from '../preview-lib/harness'

/**
 * The ITUN app chrome header — brand, nav, Buy the game and the nav drawer. A
 * thin preset over `AppBar`, so the masthead vocabulary is shared but the
 * configuration is the builder's.
 */
export function Chrome() {
  return (
    <div className="bg-paper p-4">
      <Caption>app header</Caption>
      <AppHeader />
    </div>
  )
}
