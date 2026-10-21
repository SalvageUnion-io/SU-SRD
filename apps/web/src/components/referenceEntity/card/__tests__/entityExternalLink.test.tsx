/**
 * Regression guard for the app-supplied entity cross-link (The app's
 * "View in the Reference"), which reaches the card as the entity surface's
 * `externalLink` and is read by `useEntityExternalLink`.
 *
 * WHY THIS EXISTS. This link silently disappeared once already, and nothing
 * caught it. The since-deleted legacy render core held the only
 * `useEntityExternalLink` call; when that file was removed in favour of
 * `ReferenceEntityCard`, the call went with it and was never reinstated. The app
 * still wired the provider in `GameDataReady` and still shipped a tested
 * builder, so both ends of the feature looked healthy — only the middle was
 * gone. The call now lives in `ReferenceEntityCard` itself, which is what this
 * file renders.
 *
 * The failure was invisible to every gate we had: deleting the sole *reader*
 * of a context removes no export, breaks no type, and fails no test. Typecheck,
 * lint and knip were all green across the change. The only thing that can
 * catch this class of bug is an assertion that the rendered output actually
 * contains the provided node, which is what this file does.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const chassis = () => {
  const first = SalvageUnionReference.Chassis.all()[0]
  if (!first) throw new Error('Chassis fixture missing')
  return first
}

const LINK_TEXT = 'View in the Reference'
const LINKED = { externalLink: () => <a href="/srd">{LINK_TEXT}</a> }

const renderWithLink = () =>
  render(
    <EntitySurfaceProvider value={LINKED}>
      <ReferenceEntityCard data={chassis()} />
    </EntitySurfaceProvider>
  )

describe('entity card external cross-link', () => {
  test('renders the provided link in the identity footer', () => {
    renderWithLink()
    expect(screen.getByText(LINK_TEXT)).toBeTruthy()
  })

  test('renders nothing extra when no provider supplies a builder', () => {
    render(<ReferenceEntityCard data={chassis()} />)
    expect(screen.queryByText(LINK_TEXT)).toBeNull()
  })
})
