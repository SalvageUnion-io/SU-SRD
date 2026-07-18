import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { EntityGrid, EntityGridRow } from './EntityGrid'
import { DisplayCard } from './DisplayCard'
import { Button } from '../chrome/Button'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity Grid',
}

/** Header for a generic entity card — abstract, so the grid + economy read as the subject. */
function cardHeader(title: string) {
  return (
    <Text variant="pseudoheader" as="span">
      {title}
    </Text>
  )
}

/** Abstract body — a stand-in for whatever card the layout primitive holds. */
const body = (
  <div className="p-3">
    <Text as="p" className="text-sm text-ink-2">
      Entity body — an abstract stand-in for whatever card the grid holds.
    </Text>
  </div>
)

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 bg-paper p-5 font-mono text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      {children}
    </div>
  )
}

// The rail card's action economy is real weapon-activation data: the .50 Cal
// Machine Gun costs EP to fire and adds Heat — the one place the primitive's
// own mechanic surfaces, so it uses real numbers, not an abstract stand-in.
const railFootMeta = [
  { label: 'EP', value: 2 },
  { label: '+HEAT', value: 1 },
]

/**
 * The grid caps at two columns on desktop, one on mobile, with equal-height
 * rows. Mode 'card' folds the economy into the card foot; mode 'rail' puts the
 * 152px meta + action callout beside the card.
 */
export const Default: Story = () => (
  <Gallery rule="EntityGrid: 1 column on mobile, max 2 on desktop, equal-height rows (26px row gap / 18px column gap). Left row folds footMeta into the card foot ('card'); right row breaks the economy out into a 152px rail callout ('rail') — real .50 Cal Machine Gun activation cost, EP 2 / +HEAT 1, above stacked action buttons. Rust rides only the Use control.">
    <EntityGrid>
      <EntityGridRow footMeta={[{ label: 'SP', value: 12 }]}>
        <DisplayCard headerBg="bg-su-green" headerContent={cardHeader('Salvage Rig')}>
          {body}
        </DisplayCard>
      </EntityGridRow>
      <EntityGridRow
        mode="rail"
        footMeta={railFootMeta}
        actions={
          <>
            <Button variant="primary" size="sm">
              Use
            </Button>
            <Button variant="default" size="sm">
              Repair
            </Button>
          </>
        }
      >
        <DisplayCard headerBg="bg-su-green" headerContent={cardHeader('.50 Cal Machine Gun')}>
          {body}
        </DisplayCard>
      </EntityGridRow>
    </EntityGrid>
  </Gallery>
)
