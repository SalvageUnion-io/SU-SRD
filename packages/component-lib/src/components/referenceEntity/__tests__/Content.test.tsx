/**
 * `Content` is the block renderer every entity card's prose goes through. Each
 * `type` maps to a different atom — a `cost` datavalue becomes an
 * ActivationCost, a `trait`/`keyword` datavalue becomes a tooltip-bearing Stat,
 * a heading becomes a Slab, `choice` markers are stripped entirely — and an
 * unhandled type silently falls through to plain prose. None of that mapping is
 * type-checked (the block `type` is a free string), so the branches are pinned
 * here with assertions about what actually reaches the DOM.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { Content } from '../Content'

const blocks = (...items: unknown[]) => items as SURefObjectContentBlock[]

describe('Content — empty inputs', () => {
  test('renders nothing for an absent or empty body', () => {
    expect(render(<Content body={[]} />).container.innerHTML).toBe('')
    cleanup()
    expect(
      render(<Content body={undefined as unknown as SURefObjectContentBlock[]} />).container
        .innerHTML
    ).toBe('')
  })

  test('a body of nothing but `choice` markers renders nothing', () => {
    // `choice` blocks are position markers for the editable walk — they carry
    // no display content, so read-only output must be identical to data
    // without them (not an empty wrapper full of blanks).
    const { container } = render(
      <Content body={blocks({ type: 'choice', value: 'ignored' }, { type: 'choice' })} />
    )
    expect(container.innerHTML).toBe('')
  })

  test('`choice` markers are stripped from a body that also has prose', () => {
    render(
      <Content
        body={blocks(
          { type: 'choice', value: 'MARKER TEXT' },
          { type: 'paragraph', value: 'real prose' }
        )}
      />
    )
    expect(screen.getByText('real prose')).toBeTruthy()
    expect(screen.queryByText('MARKER TEXT')).toBeNull()
  })
})

describe('Content — block types', () => {
  test('paragraph, hint and flavor each render their text', () => {
    render(
      <Content
        body={blocks(
          { type: 'paragraph', value: 'plain prose' },
          { type: 'hint', value: 'a helpful hint' },
          { type: 'flavor', value: 'evocative flavour' }
        )}
      />
    )
    expect(screen.getByText('plain prose')).toBeTruthy()
    expect(screen.getByText('a helpful hint')).toBeTruthy()
    expect(screen.getByText('evocative flavour')).toBeTruthy()
  })

  test('an unknown block type falls back to body prose rather than disappearing', () => {
    render(<Content body={blocks({ type: 'not-a-real-type', value: 'still visible' })} />)
    expect(screen.getByText('still visible')).toBeTruthy()
  })

  test('a `label` block stamps its label above its prose', () => {
    render(<Content body={blocks({ type: 'label', label: 'Effect', value: 'the effect' })} />)
    expect(screen.getByText('Effect')).toBeTruthy()
    expect(screen.getByText('the effect')).toBeTruthy()
  })

  test('a `label` block with no label renders just its prose', () => {
    render(<Content body={blocks({ type: 'label', value: 'unlabelled' })} />)
    expect(screen.getByText('unlabelled')).toBeTruthy()
  })

  test('a labelled list-item leads with a bold label; an unlabelled one is a bare bullet', () => {
    render(
      <Content
        body={blocks(
          { type: 'list-item', label: 'Motivation', value: 'find the crawler' },
          { type: 'list-item', value: 'no label here' }
        )}
      />
    )
    expect(screen.getByText('Motivation:')).toBeTruthy()
    expect(screen.getByText('find the crawler')).toBeTruthy()
    expect(screen.getByText('no label here')).toBeTruthy()
  })

  test('[(CHASSIS)] is substituted with the owning chassis name', () => {
    render(
      <Content
        body={blocks({ type: 'paragraph', value: '[(CHASSIS)] comes with a drone.' })}
        chassisName="Little Sestra"
      />
    )
    expect(screen.getByText('The Little Sestra comes with a drone.')).toBeTruthy()
  })
})

describe('Content — datavalues chips', () => {
  test('an empty or non-array datavalues block renders nothing', () => {
    expect(
      render(<Content body={blocks({ type: 'datavalues', value: [] })} />).container.textContent
    ).toBe('')
    cleanup()
    expect(
      render(<Content body={blocks({ type: 'datavalues', value: 'not an array' })} />).container
        .textContent
    ).toBe('')
  })

  test('a cost datavalue splits a trailing currency out of its label', () => {
    // "3 AP" arrives as one label with no `value`. ActivationCost always prints
    // `cost + " " + currency` and defaults the currency to AP, so if the chip
    // does not split the label itself the pennant reads "3 AP AP".
    render(
      <Content body={blocks({ type: 'datavalues', value: [{ type: 'cost', label: '3 AP' }] })} />
    )
    expect(screen.getByText('3 AP')).toBeTruthy()
  })

  test('every recognised currency suffix is split, not just AP', () => {
    for (const currency of ['AP', 'EP', 'XP']) {
      render(
        <Content
          body={blocks({ type: 'datavalues', value: [{ type: 'cost', label: `2 ${currency}` }] })}
        />
      )
      expect(screen.getByText(`2 ${currency}`)).toBeTruthy()
      cleanup()
    }
  })

  test('a cost datavalue with an explicit value keeps both halves as given', () => {
    render(
      <Content
        body={blocks({ type: 'datavalues', value: [{ type: 'cost', label: '2', value: 'EP' }] })}
      />
    )
    expect(screen.getByText('2 EP')).toBeTruthy()
  })

  test('a cost label with no recognised currency suffix is left unsplit', () => {
    render(
      <Content body={blocks({ type: 'datavalues', value: [{ type: 'cost', label: 'Free' }] })} />
    )
    // Not split — the whole label stays the cost and the AP default applies.
    expect(screen.getByText('Free AP')).toBeTruthy()
  })

  test('a plain datavalue joins its value and unit', () => {
    render(
      <Content
        body={blocks({
          type: 'datavalues',
          value: [{ type: 'stat', label: 'Range', value: '3', unit: 'Hexes' }],
        })}
      />
    )
    expect(screen.getByText('Range')).toBeTruthy()
    expect(screen.getByText('3 Hexes')).toBeTruthy()
  })

  test('a trait datavalue renders its label as a stat chip', () => {
    render(
      <Content
        body={blocks({ type: 'datavalues', value: [{ type: 'trait', label: 'Anti-Personnel' }] })}
      />
    )
    expect(screen.getByText('Anti-Personnel')).toBeTruthy()
  })

  test('a keyword datavalue renders its label as a stat chip', () => {
    render(
      <Content
        body={blocks({ type: 'datavalues', value: [{ type: 'keyword', label: 'Melee' }] })}
      />
    )
    expect(screen.getByText('Melee')).toBeTruthy()
  })
})

describe('Content — section grouping', () => {
  // Grouping is gated on a derivable border colour: with no `headerBg` the
  // blocks render as one flat flow, with one they split into sections led by
  // the heading. Both shapes must still show every block.
  const body = () =>
    blocks(
      { type: 'paragraph', value: 'lead-in prose' },
      { type: 'heading', level: 1, value: 'Big Heading' },
      { type: 'paragraph', value: 'section prose' }
    )

  test('renders every block ungrouped when no header colour is supplied', () => {
    render(<Content body={body()} />)
    expect(screen.getByText('lead-in prose')).toBeTruthy()
    expect(screen.getByText('Big Heading')).toBeTruthy()
    expect(screen.getByText('section prose')).toBeTruthy()
  })

  test('renders every block when grouping into sections', () => {
    render(<Content body={body()} headerBg="bg-pilot" />)
    expect(screen.getByText('lead-in prose')).toBeTruthy()
    expect(screen.getByText('Big Heading')).toBeTruthy()
    expect(screen.getByText('section prose')).toBeTruthy()
  })

  test("a datavalues block's own label leads its section", () => {
    render(
      <Content
        body={blocks({
          type: 'datavalues',
          label: 'Requirements',
          value: [{ type: 'stat', label: 'Tech Level', value: '2' }],
        })}
        headerBg="bg-pilot"
      />
    )
    expect(screen.getByText('Requirements')).toBeTruthy()
    expect(screen.getByText('Tech Level')).toBeTruthy()
  })
})
