import type { Story } from '@ladle/react'
import { InlineContentBlock } from './InlineContentBlock'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { Text } from '../base/Text'

export default {
  title: 'Entity/InlineContentBlock',
}

const paragraphBlock: SURefObjectContentBlock = {
  type: 'paragraph',
  value: 'Deals 3 damage to a target within range.',
}

const hintBlock: SURefObjectContentBlock = {
  type: 'hint',
  value: 'This ability can be used once per round.',
}

export const Paragraph: Story = () => (
  <div className="w-[500px] bg-su-white p-3">
    <div className="flex items-center gap-1">
      <Text as="span" className="font-bold">
        Laser Cutter:
      </Text>
      <InlineContentBlock block={paragraphBlock} fontSize="sm" />
    </div>
  </div>
)

export const Hint: Story = () => (
  <div className="w-[500px] bg-su-white p-3">
    <div className="flex items-center gap-1">
      <Text as="span" className="font-bold">
        Note:
      </Text>
      <InlineContentBlock block={hintBlock} fontSize="sm" />
    </div>
  </div>
)
