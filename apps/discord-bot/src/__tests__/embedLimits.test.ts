/**
 * Discord embed-limit enforcement.
 *
 * These exist because `gameEmbed.ts` previously enforced nothing beyond a
 * per-field truncate: it had no `total` and no `footer` in its limits, so an
 * oversized embed would have been rejected by Discord with a 400 and the reply
 * would have failed outright rather than degrading. Every case below is one of
 * the ways a sheet-sized embed can cross a limit.
 */
import { describe, expect, test } from 'bun:test'
import {
  EMBED_LIMIT,
  embedLength,
  enforceElementLimits,
  enforceEmbedLimits,
  stripDanglingLink,
} from '../format.js'

/** A minimal enforceable embed; fields are supplied per-test. */
function embed(
  fields: { name: string; value: string }[],
  extra: Partial<{ title: string; description: string; footer: string }> = {}
) {
  return {
    title: extra.title ?? 'Title',
    footer: extra.footer ?? 'In The Union Now',
    ...(extra.description === undefined ? {} : { description: extra.description }),
    fields: fields.map((f) => ({ ...f, inline: false })),
  }
}

describe('stripDanglingLink', () => {
  test('leaves a complete trailing link alone', () => {
    const text = 'before [Armour Plating](https://salvageunion.io/x)'
    expect(stripDanglingLink(text)).toBe(text)
  })

  test('drops a link cut before its closing bracket', () => {
    expect(stripDanglingLink('kept [Armour Pla')).toBe('kept')
  })

  test('drops a link cut inside the URL', () => {
    expect(stripDanglingLink('kept [Armour Plating](https://salvage')).toBe('kept')
  })

  test('leaves text with no bracket at all alone', () => {
    expect(stripDanglingLink('no links here')).toBe('no links here')
  })

  test('handles an empty string', () => {
    expect(stripDanglingLink('')).toBe('')
  })
})

describe('embedLength', () => {
  test('counts title, description, footer and every field name and value', () => {
    const e = embed([{ name: 'ab', value: 'cde' }], {
      title: 'xy',
      description: 'zzz',
      footer: 'ff',
    })
    // 2 title + 3 description + 2 footer + 2 name + 3 value
    expect(embedLength(e)).toBe(12)
  })

  test('treats an absent description as zero', () => {
    expect(embedLength(embed([], { title: 'abc', footer: '' }))).toBe(3)
  })
})

describe('enforceElementLimits', () => {
  test('caps the field count at 25', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `f${i}`, value: 'v' }))
    expect(enforceElementLimits(embed(many)).fields).toHaveLength(EMBED_LIMIT.fields)
  })

  test('truncates an over-long field value', () => {
    const long = 'x'.repeat(EMBED_LIMIT.fieldValue + 500)
    const [field] = enforceElementLimits(embed([{ name: 'n', value: long }])).fields
    expect(field?.value.length).toBeLessThanOrEqual(EMBED_LIMIT.fieldValue)
  })

  test('leaves a field value that already fits completely untouched', () => {
    const value = '[First Aid Kit](https://salvageunion.io/x)'
    const [field] = enforceElementLimits(embed([{ name: 'n', value }])).fields
    expect(field?.value).toBe(value)
  })

  test('does not leave a half-written markdown link after trimming', () => {
    // One link per line, sized so the cut lands mid-link rather than on a boundary.
    const line =
      '[Reinforced Polycarbonate Shield](https://salvageunion.io/schema/equipment/item/x)'
    const value = Array.from({ length: 40 }, () => line).join('\n')
    const [field] = enforceElementLimits(embed([{ name: 'n', value }])).fields
    const openers = (field?.value.match(/\[/g) ?? []).length
    const complete = (field?.value.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length
    expect(openers).toBe(complete)
  })

  test('truncates the title and footer', () => {
    const e = enforceElementLimits(
      embed([], { title: 'T'.repeat(400), footer: 'F'.repeat(EMBED_LIMIT.footer + 50) })
    )
    expect(e.title.length).toBeLessThanOrEqual(EMBED_LIMIT.title)
    expect(e.footer.length).toBeLessThanOrEqual(EMBED_LIMIT.footer)
  })
})

describe('enforceEmbedLimits', () => {
  test('leaves a realistically-sized sheet embed untouched', () => {
    // The measured worst case for a real pilot is ~2000 chars, well inside.
    const e = embed([
      { name: 'HP', value: '████████░░ 8/10' },
      { name: 'Abilities — 3 known', value: '[A](https://x)\n[B](https://y)' },
    ])
    const before = JSON.parse(JSON.stringify(e)) as typeof e
    expect(enforceEmbedLimits(e)).toEqual(before)
  })

  test('sheds fields until the total fits', () => {
    // 12 fields x ~1000 chars each is ~12000, double the ceiling.
    const fat = Array.from({ length: 12 }, (_, i) => ({
      name: `Section ${i}`,
      value: 'x'.repeat(1000),
    }))
    const e = enforceEmbedLimits(embed(fat))
    expect(embedLength(e)).toBeLessThanOrEqual(EMBED_LIMIT.total)
  })

  test('says how many sections it dropped rather than trimming silently', () => {
    const fat = Array.from({ length: 12 }, (_, i) => ({
      name: `Section ${i}`,
      value: 'x'.repeat(1000),
    }))
    const e = enforceEmbedLimits(embed(fat))
    const last = e.fields.at(-1)
    expect(last?.name).toBe('Trimmed')
    expect(last?.value).toMatch(/sections omitted/)
  })

  test('keeps the earliest fields, because vitals are rendered first', () => {
    const fat = Array.from({ length: 12 }, (_, i) => ({
      name: `Section ${i}`,
      value: 'x'.repeat(1000),
    }))
    const e = enforceEmbedLimits(embed(fat))
    expect(e.fields[0]?.name).toBe('Section 0')
  })

  test('applies element caps as well as the total', () => {
    const e = enforceEmbedLimits(
      embed([{ name: 'n', value: 'x'.repeat(EMBED_LIMIT.fieldValue + 100) }], {
        title: 'T'.repeat(400),
      })
    )
    expect(e.title.length).toBeLessThanOrEqual(EMBED_LIMIT.title)
    expect(e.fields[0]?.value.length).toBeLessThanOrEqual(EMBED_LIMIT.fieldValue)
  })

  test('still fits when a single field alone would exceed the total', () => {
    // 25 maximal fields is 25 x 1024 = 25600, so shedding must be aggressive.
    const worst = Array.from({ length: 25 }, (_, i) => ({
      name: `S${i}`,
      value: 'x'.repeat(EMBED_LIMIT.fieldValue),
    }))
    const e = enforceEmbedLimits(embed(worst))
    expect(embedLength(e)).toBeLessThanOrEqual(EMBED_LIMIT.total)
  })
})
