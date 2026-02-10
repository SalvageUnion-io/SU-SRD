import type { Story } from '@ladle/react'
import { Flex } from '@chakra-ui/react'
import { DataValueDisplayView } from './DataValueDisplayView'
import type { DataValue } from '../../types/common'

export default {
  title: 'Entity/DataValueDisplayView',
}

const costItem: DataValue = { label: '2 EP', type: 'cost' }
const traitItem: DataValue = { label: 'Blast', type: 'trait' }
const keywordItem: DataValue = { label: 'Salvage', type: 'keyword' }
const metaItem: DataValue = { label: 'RANGE 2', type: 'meta' }
const labelValue: DataValue = { label: 'SP', value: '8' }
const labelOnly: DataValue = { label: 'PASSIVE' }

export const AllTypes: Story = () => (
  <Flex gap={3} flexWrap="wrap">
    <DataValueDisplayView item={costItem} />
    <DataValueDisplayView item={traitItem} />
    <DataValueDisplayView item={keywordItem} />
    <DataValueDisplayView item={metaItem} />
    <DataValueDisplayView item={labelValue} />
    <DataValueDisplayView item={labelOnly} />
  </Flex>
)

export const Compact: Story = () => (
  <Flex gap={2} flexWrap="wrap">
    <DataValueDisplayView item={costItem} compact />
    <DataValueDisplayView item={traitItem} compact />
    <DataValueDisplayView item={labelValue} compact />
  </Flex>
)

export const Damaged: Story = () => (
  <Flex gap={3} flexWrap="wrap">
    <DataValueDisplayView item={labelValue} damaged />
    <DataValueDisplayView item={metaItem} damaged />
    <DataValueDisplayView item={labelOnly} damaged />
  </Flex>
)
