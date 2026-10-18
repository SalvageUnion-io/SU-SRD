/**
 * The header band — ONE anatomy, TWO fills (ruleset §5, board E1).
 *
 * happy-dom performs no layout, so these pin the structure and the style the
 * rules encode rather than pixel widths. The band's static layout is
 * `.su-ec-band*` classes (ADR-046, repeated elements), so those are read off
 * the element's classes and the stylesheet rule they name:
 * - a TONE header carries the title, then the chip group; an INK header adds
 *   the tier numeral before the title;
 * - the chips sit right of the title or under it by the band's own width:
 *   the name never shrinks to share its line, so the chips wrap whole;
 * - the kind is never stamped: the title carries it for screen readers;
 * - the speckle rides the band as a background image (ink grain on tone, paper
 *   flecks on ink), and is absent when the card asks for none.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { readPackageStylesheet } from '../../../../styles/__tests__/packageStylesheet'
import { EntityCardHeader } from '../EntityCardHeader'

const css = readPackageStylesheet()

/** The declarations of the stylesheet rule whose selector is exactly `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
  const body = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1]
  if (body === undefined) throw new Error(`no rule for ${selector}`)
  return body
}

const band = (title: string) => {
  const el = screen.getByText(title).closest('[data-fill]')
  if (!(el instanceof HTMLElement)) throw new Error('no header band')
  return el
}

const chips = <div className="su-chips">SLOTS 3</div>

describe('EntityCardHeader — two fills', () => {
  test('a tone header: the tone, ink speckle, the title then the chips', () => {
    render(
      <EntityCardHeader
        title="Salvaging Drill"
        fill="tone"
        bandColor="var(--color-tl-2)"
        titleSize="31px"
        chips={chips}
        size="full"
        grain="ink"
        ruled
      />
    )
    const header = band('Salvaging Drill')
    expect(header.dataset.fill).toBe('tone')
    expect(header.style.backgroundColor).toBe('var(--color-tl-2)')
    // The speckle rides the band (happy-dom drops the SVG background image
    // itself, so the grain is read off the band's marker).
    expect(header.dataset.grain).toBe('ink')
    expect(header.classList).toContain('su-grain--ink')
    // Closed by the 1.5px ink rule, unless nothing follows the band.
    expect(header.classList).toContain('su-ec-band--ruled')
    expect(rule('.su-ec-band--ruled')).toContain(
      'border-bottom: var(--bw-chrome) solid var(--color-ink)'
    )
    expect(rule('.su-ec-band--ruled:last-child')).toContain('border-bottom-width: 0')
    const heading = header.querySelector('.su-ec-band__heading')
    expect(heading?.lastElementChild?.textContent).toBe('SLOTS 3')
  })

  test('an ink header: the numeral leads, dimmed', () => {
    render(
      <EntityCardHeader
        title="Jury Rig"
        fill="ink"
        bandColor="var(--color-ink)"
        titleSize="26px"
        titleColor="var(--color-paper)"
        numeral="1"
        size="full"
        grain="paper"
      />
    )
    const header = band('Jury Rig')
    expect(header.dataset.fill).toBe('ink')
    expect(header.dataset.grain).toBe('paper')
    const numeral = screen.getByText('1')
    // Same type as the title, slightly dimmed.
    expect(numeral.style.fontSize).toBe('26px')
    expect(numeral.classList).toContain('su-ec-band__title')
    expect(numeral.classList).toContain('su-ec-band__numeral')
    expect(rule('.su-ec-band__numeral')).toContain('opacity: 0.75')
  })

  test('no grain when the card asks for none (Play, a tooltip)', () => {
    render(
      <EntityCardHeader
        title="Salvaging Drill"
        fill="tone"
        bandColor="var(--color-tl-2)"
        titleSize="22px"
        size="compact"
      />
    )
    expect(band('Salvaging Drill').dataset.grain).toBeUndefined()
  })
})

describe('EntityCardHeader — the chips beside the title or under it', () => {
  test('the heading wraps; the name keeps its one-line width and grows', () => {
    const heading = rule('.su-ec-band__heading')
    expect(heading).toContain('flex-wrap: wrap')
    expect(heading).toContain('flex: 1 1 0')
    const name = rule('.su-ec-band__name')
    // Its basis is its natural width and it never shrinks for the chips.
    expect(name).toContain('flex: 1 0 auto')
    expect(name).toContain('max-width: 100%')
    expect(rule('.su-ec-band__heading > .su-chips')).toContain('flex: 0 1 auto')
    // No viewport rule decides it.
    expect(css).not.toMatch(/@media[^{]*\{[^}]*su-ec-band__heading/)
  })

  test('the kind is for screen readers only, at the end of the title', () => {
    render(
      <EntityCardHeader
        title="Counter-Hacking"
        kind="Ability · Advanced Hacking Tree"
        fill="ink"
        bandColor="var(--color-ink)"
        titleSize="22px"
        titleAs="h3"
        size="compact"
      />
    )
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toBe('Counter-Hacking (Ability, Advanced Hacking Tree)')
    const kind = heading.querySelector('.su-sr-only')
    expect(kind?.textContent).toBe(' (Ability, Advanced Hacking Tree)')
  })

  test('the labels sit right of the title, on its line', () => {
    render(
      <EntityCardHeader
        title="Cargo Pod"
        fill="tone"
        bandColor="var(--color-tl-1)"
        titleSize="22px"
        size="compact"
        labels={<span>User-made</span>}
      />
    )
    const row = band('Cargo Pod')
    // Symmetric: the band holds no room above for a border-riding stamp.
    expect(row.style.padding).toBe('8px 10px')
    const title = screen.getByText('Cargo Pod').parentElement as HTMLElement
    const labels = title.nextElementSibling as HTMLElement
    expect(labels.textContent).toBe('User-made')
    expect(title.parentElement?.classList).toContain('su-ec-band__name')
  })

  test('a full card title wraps and carries no truncation tooltip', () => {
    render(
      <EntityCardHeader
        title="Coolant Flush"
        fill="tone"
        bandColor="var(--color-tl-1)"
        titleSize="22px"
        size="compact"
      />
    )
    const title = screen.getByText('Coolant Flush').parentElement as HTMLElement
    expect(title.getAttribute('title')).toBeNull()
    expect(title.style.whiteSpace).toBe('')
  })
})
