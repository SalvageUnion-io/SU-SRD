import type { Story } from '@ladle/react'
import type { SURefEnumSource } from 'salvageunion-reference'
import { Card } from './Card'
import { Text } from '../base/Text'
import { ValueDisplay } from './ValueDisplay'

export default {
  title: 'Shared/Card',
}

export const Default: Story = () => (
  <div className="w-[400px]">
    <Card title="Standard Card" bg="bg-su-blue-light">
      <Text>Card body content goes here.</Text>
    </Card>
  </div>
)

export const WithHeaderContent: Story = () => (
  <div className="w-[400px]">
    <Card
      title="Mech Card"
      bg="bg-su-green"
      rightContent={<ValueDisplay label="SP" value={8} />}
      subTitleContent={<ValueDisplay label="TL" value={3} />}
    >
      <Text>A mech card with right and subtitle content.</Text>
    </Card>
  </div>
)

export const Compact: Story = () => (
  <div className="w-[300px]">
    <Card title="Compact Card" bg="bg-su-orange" compact>
      <Text className="text-sm">Compact body content.</Text>
    </Card>
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[400px]">
    <Card title="Disabled Card" bg="bg-su-blue-light" disabled>
      <Text>This card is disabled.</Text>
    </Card>
  </div>
)

export const WithLabel: Story = () => (
  <div className="w-[400px] pt-4">
    <Card title="Pilot Name" bg="bg-su-orange" label="PILOT">
      <Text>Card with a label above.</Text>
    </Card>
  </div>
)

export const HeaderOnly: Story = () => (
  <div className="w-[400px]">
    <Card title="Header Only Card" bg="bg-su-pink" />
  </div>
)

export const Reversed: Story = () => (
  <div className="w-[400px]">
    <Card
      title="Reversed Layout"
      bg="bg-su-blue-two"
      reverse
      rightContent={<ValueDisplay label="EP" value={2} />}
    >
      <Text>Title and right content are swapped.</Text>
    </Card>
  </div>
)

export const MultipleCards: Story = () => (
  <div className="flex w-[400px] flex-col gap-4">
    <Card title="Mech Systems" bg="bg-su-green">
      <Text>Green for mechs.</Text>
    </Card>
    <Card title="Pilot Abilities" bg="bg-su-orange">
      <Text>Orange for pilots.</Text>
    </Card>
    <Card title="Crawler Bays" bg="bg-su-pink">
      <Text>Pink for crawlers.</Text>
    </Card>
  </div>
)

export const ExpansionRainmaker: Story = () => (
  <div className="w-[400px] py-6">
    <Card
      title="Rainmaker System"
      bg="bg-su-blue"
      source={'Rainmaker' as SURefEnumSource}
      isExpanded
    >
      <Text>Raindrops fall from header and rise from footer.</Text>
    </Card>
  </div>
)

export const ExpansionWeWereHereFirst: Story = () => (
  <div className="w-[400px] py-6">
    <Card
      title="WWHF Chassis"
      bg="bg-su-brick"
      source={'We Were Here First!' as SURefEnumSource}
      isExpanded
    >
      <Text>Beast-like fangs on header and footer edges.</Text>
    </Card>
  </div>
)

export const ExpansionFalseFlag: Story = () => (
  <div className="w-[400px]">
    <Card
      title="False Flag Module"
      bg="bg-su-grey-dark"
      source={'False Flag' as SURefEnumSource}
      isExpanded
    >
      <Text>Windows 95-esque beveled border.</Text>
    </Card>
  </div>
)

export const AllExpansions: Story = () => (
  <div className="flex w-[400px] flex-col gap-8 py-6">
    <Card title="Rainmaker" bg="bg-su-blue" source={'Rainmaker' as SURefEnumSource} isExpanded>
      <Text>Falling raindrops effect.</Text>
    </Card>
    <Card
      title="We Were Here First!"
      bg="bg-su-brick"
      source={'We Were Here First!' as SURefEnumSource}
      isExpanded
    >
      <Text>Beast fangs effect.</Text>
    </Card>
    <Card
      title="False Flag"
      bg="bg-su-grey-dark"
      source={'False Flag' as SURefEnumSource}
      isExpanded
    >
      <Text>Win95 bevel effect.</Text>
    </Card>
    <Card title="Core Rulebook" bg="bg-su-orange">
      <Text>No expansion effect (core content).</Text>
    </Card>
  </div>
)
