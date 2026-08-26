/* Ported from packages/component-lib/src/components/chrome/Banner.stories.tsx. */
import { Banner } from 'component-lib'
import { Group, Stack } from '../preview-lib/harness'

// Real Salvage Union soft-warnings: an illegal starting pattern, a pilot out of
// Energy Points, and the autosave notice — the advisory copy ITUN actually
// raises on the mech sheet.
const LEGAL_PATTERN = { severity: 'info', message: 'This pattern is not a legal starting pattern.' }
const NO_EP = { severity: 'warn', message: '0 EP — some actions unavailable.' }
const AUTOSAVE = { severity: 'info', message: 'Auto-saved to this device.' }

/**
 * The advisory strip. Every row is informational — a Banner never blocks, it
 * only reports.
 */
export function Severities() {
  return (
    <div className="max-w-md bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="info">
          <Banner warnings={[LEGAL_PATTERN]} />
        </Group>
        <Group caption="warn">
          <Banner warnings={[NO_EP]} />
        </Group>
        <Group caption="info · passive">
          <Banner warnings={[AUTOSAVE]} />
        </Group>
      </Stack>
    </div>
  )
}

/** Several severities stacked in one strip. */
export function Stacked() {
  return (
    <div className="max-w-md bg-paper p-4">
      <Banner warnings={[LEGAL_PATTERN, NO_EP, AUTOSAVE]} />
    </div>
  )
}
