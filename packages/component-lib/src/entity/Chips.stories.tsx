import type { CSSProperties, ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { space } from '../design/tokens'
import type { Story } from '../stories/_harness'
import { Caption } from '../stories/_harness'
import { Entity } from './Entity'

/**
 * The chip group (E17) across entity types and forms: every chip of an entity
 * — action type, cost, facts, traits — in one group and one style, right of
 * the title where the band has room and under it where it does not. The same
 * entities the chip-placement prototype compared, so a change lines up with
 * its shots. View each at the catalog's phone, column and page widths.
 */
export default {
  title: 'Compositions/Entity/Chips',
}

const stack: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[16],
}

function named<T extends { name: string }>(list: T[], name: string): T {
  const found = list.find((e) => e.name === name)
  if (!found) throw new Error(`chip group story: no ${name}`)
  return found
}

const R = SalvageUnionReference
const system = named(R.Systems.all(), '.50 Cal Machine Gun')
const module_ = named(R.Modules.all(), 'Firewall')
const ability = named(R.Abilities.all(), 'Counter-Hacking')
const equipment = named(R.Equipment.all(), 'Portable Flamethrower')
const npc = named(R.NPCs.all(), 'Skull Drone')
const bioTitan = named(R.BioTitans.all(), 'Scylla')
const creature = named(R.Creatures.all(), 'Wasteland Bear')
const chassis = named(R.Chassis.all(), 'Little Sestra')
const pattern = named(chassis.patterns ?? [], 'Surveyor')
const bay = named(R.CrawlerBays.all(), 'Command Bay')
const keyword = named(R.Keywords.all(), 'action scene')
const trait = named(R.Traits.all(), 'hot')

const asEntity = (e: unknown) => e as SURefEntity

function CardStory({ entity, children }: { entity: unknown; children?: ReactNode }) {
  return <div style={stack}>{children ?? <ReferenceEntityCard data={asEntity(entity)} />}</div>
}

/** The Row two ways: an SRD listing Row (link, lead) and the compact card (`extent="head"`). */
function RowStory({ entity }: { entity: unknown }) {
  return (
    <div style={stack}>
      <Caption>listing row (link, lead)</Caption>
      <Entity form="row" entity={asEntity(entity)} mode={{ kind: 'link', href: '#' }} lead />
      <Caption>compact card (extent head, clickable)</Caption>
      <ReferenceEntityCard data={asEntity(entity)} size="medium" extent="head" cardClickable />
    </div>
  )
}

export const SystemCard: Story = () => <CardStory entity={system} />
export const SystemRow: Story = () => <RowStory entity={system} />
export const ModuleCard: Story = () => <CardStory entity={module_} />
export const ModuleRow: Story = () => <RowStory entity={module_} />
export const AbilityCard: Story = () => <CardStory entity={ability} />
export const AbilityRow: Story = () => <RowStory entity={ability} />
export const EquipmentCard: Story = () => <CardStory entity={equipment} />
export const EquipmentRow: Story = () => <RowStory entity={equipment} />
export const NpcCard: Story = () => <CardStory entity={npc} />
export const NpcRow: Story = () => <RowStory entity={npc} />
export const BioTitanCard: Story = () => <CardStory entity={bioTitan} />
export const CreatureCard: Story = () => <CardStory entity={creature} />
export const ChassisCard: Story = () => <CardStory entity={chassis} />
export const ChassisRow: Story = () => <RowStory entity={chassis} />
export const PatternCard: Story = () => (
  <CardStory entity={chassis}>
    <ReferenceEntityCard data={asEntity(chassis)} pattern={pattern} />
  </CardStory>
)
export const CrawlerBayCard: Story = () => <CardStory entity={bay} />
export const CrawlerBayRow: Story = () => <RowStory entity={bay} />
export const KeywordCard: Story = () => <CardStory entity={keyword} />
export const TraitCard: Story = () => <CardStory entity={trait} />
