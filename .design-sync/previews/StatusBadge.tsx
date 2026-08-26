/*
 * Ported from packages/component-lib/src/components/chrome/StatusBadge.stories.tsx.
 *
 * Two changes from the story: the click-to-cycle handler is dropped (a card is a
 * still image, so the three states are shown side by side instead), and the
 * story's second row — the same three badges again, with `subject` set — is
 * replaced by an in-context row. `subject` only contributes the accessible
 * name, so that second row rendered pixel-identical to the first and showed a
 * variant axis that does not exist.
 */
import { StatusBadge } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Row, Stack } from '../preview-lib/harness'

const STATUSES = ['intact', 'damaged', 'destroyed'] as const

/**
 * Entity status — a composition over Badge's tone scale carrying the entity
 * condition vocabulary: Intact / Damaged / Destroyed. `subject` names the
 * entity the condition belongs to for screen readers.
 */
export function States() {
  const bays = SalvageUnionReference.CrawlerBays.all().slice(0, 3)
  return (
    <Stack gap="1.5rem">
      <Group caption="the three conditions">
        <Row>
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </Row>
      </Group>
      <Group caption="in context — one bay per condition, subject set">
        <div className="flex max-w-sm flex-col gap-2">
          {bays.map((bay, i) => (
            <div
              key={bay.name}
              className="flex items-center justify-between gap-3 border-chrome border-ink bg-paper px-3 py-2"
            >
              <span className="font-body text-sm text-ink">{bay.name}</span>
              <StatusBadge status={STATUSES[i % STATUSES.length]} subject={bay.name} />
            </div>
          ))}
        </div>
      </Group>
    </Stack>
  )
}
