/* Ported from packages/component-lib/src/components/chrome/Panel.stories.tsx. */
import { Panel, Row } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The list frame, in its two border weights, holding `Row` list items. The
 * zero-state placeholder is `EmptyState variant="quiet"`, not a Panel prop.
 */
export function Borders() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const system = SalvageUnionReference.Systems.all()[0]
  const crawler = SalvageUnionReference.Crawlers.all()[0]
  return (
    <div className="bg-paper p-4">
      <Stack gap="1.5rem">
        <Group caption="Panel (ink border) with Rows">
          <Panel className="p-2">
            <div className="flex flex-col gap-2">
              <Row
                name={chassis?.name ?? 'Chassis'}
                meta={`Chassis · TL${chassis?.techLevel ?? 1} · SV ${chassis?.salvageValue ?? 5}`}
              />
              <Row
                name={system?.name ?? 'System'}
                meta={`System · TL${system?.techLevel ?? 1}`}
                actions={
                  <span className="font-cond text-xs font-bold uppercase text-rust">Details</span>
                }
              />
            </div>
          </Panel>
        </Group>
        <Group caption="Panel (soft border)">
          <Panel soft className="p-2">
            <div className="flex flex-col gap-2">
              <Row name={crawler?.name ?? 'Crawler'} meta="Union Crawler" />
            </div>
          </Panel>
        </Group>
      </Stack>
    </div>
  )
}
