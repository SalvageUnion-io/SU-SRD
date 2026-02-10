import type { Story } from '@ladle/react'
import { Box } from '@chakra-ui/react'
import { BlockContentRendererView } from './BlockContentRendererView'
import type { SURefObjectContentBlock } from 'salvageunion-reference'

export default {
  title: 'Entity/BlockContentRendererView',
}

const paragraphBlocks: SURefObjectContentBlock[] = [
  { type: 'paragraph', value: 'This is a standard paragraph of content describing a system.' },
  {
    type: 'paragraph',
    value: 'It can span multiple blocks for longer descriptions with game mechanics.',
  },
]

const mixedBlocks: SURefObjectContentBlock[] = [
  { type: 'heading', value: 'System Overview', level: 1 },
  { type: 'paragraph', value: 'This system provides enhanced capabilities.' },
  { type: 'heading', value: 'Usage', level: 2 },
  { type: 'list-item', value: 'Activate during your turn' },
  { type: 'list-item', value: 'Costs 1 EP per use' },
  { type: 'list-item', value: 'Range 2 zones' },
  { type: 'hint', value: 'Tip: Combine with other systems for maximum effect.' },
]

const labelBlocks: SURefObjectContentBlock[] = [
  { type: 'label', label: 'EFFECT', value: 'Deals 3 damage to target in range.' },
  {
    type: 'label',
    label: 'ON CRITICAL',
    value: 'Deals double damage and applies Burning condition.',
  },
]

export const Paragraphs: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <BlockContentRendererView content={paragraphBlocks} damaged={false} />
  </Box>
)

export const MixedContent: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <BlockContentRendererView content={mixedBlocks} damaged={false} />
  </Box>
)

export const Labels: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <BlockContentRendererView content={labelBlocks} damaged={false} />
  </Box>
)

export const Compact: Story = () => (
  <Box w="400px" bg="su.white" p={2}>
    <BlockContentRendererView content={mixedBlocks} compact damaged={false} />
  </Box>
)

export const Damaged: Story = () => (
  <Box w="500px" bg="su.white" p={3}>
    <BlockContentRendererView content={paragraphBlocks} damaged />
  </Box>
)
