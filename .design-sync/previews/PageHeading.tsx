/* Ported from packages/component-lib/src/components/chrome/PageHeading.stories.tsx. */
import { PageHeading } from 'component-lib'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The page-level heading language shared across the reference pages: the ink
 * stamp band, and its quieter `subheading` section head.
 */
export function Variants() {
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="heading (default) — the ink stamp band">
          <PageHeading>About the Salvage Union SRD</PageHeading>
        </Group>
        <Group caption="heading — centered per-page modifier">
          <PageHeading className="text-center">JSON API Reference</PageHeading>
        </Group>
        <Group caption="subheading — the section head">
          <PageHeading variant="subheading">Available Schemas</PageHeading>
        </Group>
      </Stack>
    </div>
  )
}
