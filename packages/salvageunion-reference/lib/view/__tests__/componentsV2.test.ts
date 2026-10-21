import { describe, expect, test } from 'bun:test'
import { toComponentsV2 } from '../componentsV2'

describe('toComponentsV2', () => {
  test('writes each block as its Discord component, in order', () => {
    const json = toComponentsV2({
      accent: 0x123456,
      blocks: [
        { kind: 'text', content: 'Hi' },
        { kind: 'separator' },
        { kind: 'section', text: ['a'], thumbnail: { url: 'https://x/y.png', description: 'd' } },
        { kind: 'section', text: ['b'], button: { kind: 'link', url: 'https://z', label: 'Z' } },
        {
          kind: 'buttons',
          buttons: [
            { kind: 'action', customId: 'go', label: 'Go' },
            { kind: 'action', customId: 'no', label: 'No', style: 4, disabled: true },
          ],
        },
        {
          kind: 'select',
          customId: 'pick',
          placeholder: 'Pick',
          options: [
            { label: 'One', value: '1', description: 'first' },
            { label: 'Two', value: '2' },
          ],
        },
      ],
    })
    expect(json).toEqual({
      type: 17,
      accent_color: 0x123456,
      components: [
        { type: 10, content: 'Hi' },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 9,
          components: [{ type: 10, content: 'a' }],
          accessory: { type: 11, media: { url: 'https://x/y.png' }, description: 'd' },
        },
        {
          type: 9,
          components: [{ type: 10, content: 'b' }],
          accessory: { type: 2, style: 5, url: 'https://z', label: 'Z' },
        },
        {
          type: 1,
          components: [
            { type: 2, style: 2, custom_id: 'go', label: 'Go', disabled: false },
            { type: 2, style: 4, custom_id: 'no', label: 'No', disabled: true },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: 'pick',
              placeholder: 'Pick',
              options: [
                { label: 'One', value: '1', description: 'first' },
                { label: 'Two', value: '2' },
              ],
            },
          ],
        },
      ],
    })
  })

  test('an empty row is left out: Discord rejects one', () => {
    const json = toComponentsV2({
      accent: 0,
      blocks: [
        { kind: 'buttons', buttons: [] },
        { kind: 'select', customId: 's', placeholder: 'P', options: [] },
      ],
    })
    expect(json.components).toEqual([])
  })
})
