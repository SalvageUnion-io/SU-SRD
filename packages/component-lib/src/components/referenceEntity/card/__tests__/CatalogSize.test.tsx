/**
 * `size="medium" extent="catalog"` — the SRD index tile. Compact, artwork + description ONLY:
 * every nested element (entities, actions, choices, patterns, roll tables) is
 * suppressed so a listing page reads uniformly regardless of what the entity
 * happens to carry. These fixtures are chosen because each one DOES carry
 * nested content at full size, so the assertions would fail if it leaked.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { resolveGrantedEntities, SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** A chassis carries a `patterns` list + chassis abilities at full size. */
const chassisWithPatterns = () => {
  const found = SalvageUnionReference.Chassis.all().find(
    (c) => Array.isArray(c.patterns) && c.patterns.length > 0
  )
  if (!found) throw new Error('no chassis with patterns in fixtures')
  return found
}

/** A crawler bay carries a choice (the Armament Bay catalog listing). */
const armamentBay = () => {
  const bay = SalvageUnionReference.CrawlerBays.all().find((b) => b.name === 'Armament Bay')
  if (!bay) throw new Error('Armament Bay fixture missing')
  return bay
}

describe('ReferenceEntityCard size="medium" extent="catalog"', () => {
  test('a chassis renders its name but none of its patterns', () => {
    const chassis = chassisWithPatterns()
    const patternName = String(chassis.patterns?.[0]?.name ?? '')
    expect(patternName).not.toBe('')

    // Full size DOES surface the pattern — proves the fixture is a real probe.
    const full = render(<ReferenceEntityCard data={chassis} />)
    expect(screen.queryAllByText(new RegExp(patternName, 'i')).length).toBeGreaterThan(0)
    full.unmount()

    render(<ReferenceEntityCard data={chassis} size="medium" extent="catalog" />)
    expect(screen.getByText(chassis.name)).toBeTruthy()
    expect(screen.queryAllByText(new RegExp(patternName, 'i')).length).toBe(0)
  })

  test('a crawler bay renders no choice prompt', () => {
    const bay = armamentBay()

    const full = render(<ReferenceEntityCard data={bay} />)
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeTruthy()
    full.unmount()

    render(<ReferenceEntityCard data={bay} size="medium" extent="catalog" />)
    expect(screen.getByText(bay.name)).toBeTruthy()
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeNull()
  })

  test('a MINI catalog tile drops the artwork; every other size keeps it', () => {
    const withArt = SalvageUnionReference.Chassis.all().find((c) => c.hasArtwork)
    if (!withArt) throw new Error('no chassis with artwork in fixtures — the probe is vacuous')

    const medium = render(<ReferenceEntityCard data={withArt} size="medium" extent="catalog" />)
    expect(document.querySelectorAll('img').length).toBeGreaterThan(0)
    medium.unmount()

    render(<ReferenceEntityCard data={withArt} size="small" extent="catalog" />)
    expect(document.querySelectorAll('img').length).toBe(0)
    // The tile still names the entity — it lost the picture, not the label.
    expect(screen.getByText(withArt.name)).toBeTruthy()
  })

  test('a SMALL card can still render its whole content — size is not extent', () => {
    const bay = armamentBay()

    // `small` + `head` is the shortform token: the body is gone.
    const token = render(<ReferenceEntityCard data={bay} size="small" extent="head" />)
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeNull()
    token.unmount()

    // `small` + `full` is the same small scale WITH the content — the
    // combination the old conflated enum could not express at all.
    render(<ReferenceEntityCard data={bay} size="small" extent="full" />)
    expect(screen.getByText(bay.name)).toBeTruthy()
    expect(screen.queryByText(/Choose a Weapons System to mount/i)).toBeTruthy()
  })

  test('a grant-equipment ability catalog tile surfaces the granted entity opening description', () => {
    // Holo Companion is a granting ability with NO own content — it only grants
    // the Holo Companion equipment. In catalog mode the granted CARD is
    // suppressed, so without the granted-lead branch the tile body would be empty.
    // Instead the tile surfaces the granted equipment's opening paragraph.
    const holo = SalvageUnionReference.Abilities.all().find((a) => a.name === 'Holo Companion')
    if (!holo) throw new Error('Holo Companion ability fixture missing')
    // Precondition that makes this a real probe (not the old silently-skipping
    // `content?.length > 0` selector, which no real grant ability satisfies).
    expect(holo.content?.length ?? 0).toBe(0)

    const granted = resolveGrantedEntities(holo)
    expect(granted.length).toBeGreaterThan(0)
    const grantContent = (granted[0] as { content?: { type?: string; value?: unknown }[] }).content
    const leadBlock = grantContent?.find((b) => b?.type === 'paragraph')
    const lead = typeof leadBlock?.value === 'string' ? leadBlock.value : undefined
    expect(lead).toBeTruthy()

    render(<ReferenceEntityCard data={holo} size="medium" extent="catalog" />)
    expect(screen.getByText(holo.name)).toBeTruthy()
    // The granted equipment's opening description now renders in the tile body,
    // while the granted card itself stays suppressed (no "Grants" seal stamp).
    expect(screen.getByText(lead as string)).toBeTruthy()
    expect(screen.queryByText('Grants')).toBeNull()
  })
})
