/**
 * Regression guard for the app-supplied entity cross-link (ITUN's
 * "View in SRD →"), which reaches the card through
 * `EntityExternalLinkProvider` and is read by `useEntityExternalLink`.
 *
 * WHY THIS EXISTS. This link silently disappeared once already, and nothing
 * caught it. The legacy render core (`ReferenceEntityDisplayContent`) held the
 * only `useEntityExternalLink` call; when that file was deleted in favour of
 * `ReferenceEntityCard`, the call went with it and was never reinstated. ITUN
 * still wired the provider in `GameDataReady` and still shipped a tested
 * builder, so both ends of the feature looked healthy — only the middle was
 * gone.
 *
 * The failure was invisible to every gate we had: deleting the sole *reader*
 * of a context removes no export, breaks no type, and fails no test. Typecheck,
 * lint and knip were all green across the change. The only thing that can
 * catch this class of bug is an assertion that the rendered output actually
 * contains the provided node, which is what this file does.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { EntityExternalLinkProvider } from '../../entityHrefContext'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const chassis = () => {
  const first = SalvageUnionReference.Chassis.all()[0]
  if (!first) throw new Error('Chassis fixture missing')
  return first
}

const LINK_TEXT = 'View in SRD'

const renderWithLink = (extent: 'full' | 'head' | 'catalog') =>
  render(
    <EntityExternalLinkProvider value={() => <a href="/srd">{LINK_TEXT}</a>}>
      <ReferenceEntityCard data={chassis()} extent={extent} />
    </EntityExternalLinkProvider>
  )

afterEach(cleanup)

describe('entity card external cross-link', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('renders the provided link in the identity footer at full extent', () => {
    renderWithLink('full')
    expect(screen.getByText(LINK_TEXT)).toBeTruthy()
  })

  test('omits the link on head listings, which stay uncluttered', () => {
    renderWithLink('head')
    expect(screen.queryByText(LINK_TEXT)).toBeNull()
  })

  test('omits the link on catalog tiles', () => {
    renderWithLink('catalog')
    expect(screen.queryByText(LINK_TEXT)).toBeNull()
  })

  test('renders nothing extra when no provider supplies a builder', () => {
    render(<ReferenceEntityCard data={chassis()} extent="full" />)
    expect(screen.queryByText(LINK_TEXT)).toBeNull()
  })
})
