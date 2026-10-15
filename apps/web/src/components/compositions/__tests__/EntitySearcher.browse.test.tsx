/**
 * EntitySearcher — browse mode: a reference browser, not a picker (the
 * Dashboard's SRD Explorer). Its own file, like the other modes, so the
 * parallel runner can spread the pool renders over its workers.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { POOL_RENDER_MS } from './entitySearcherHarness'

describe('EntitySearcher — browse mode', () => {
  it(
    'has no rail, no Show facet and no on-sheet count; a card click opens it',
    () => {
      const chassis = SalvageUnionReference.Chassis.all()[0]
      if (!chassis) throw new Error('No chassis in reference data')
      const opened: string[] = []
      render(
        <EntitySearcher
          schema="chassis"
          mode="browse"
          selected={[]}
          onOpen={(ref) => opened.push(ref)}
          idOf={(i) => i.id}
          chosenLabel="Chosen"
        />
      )
      expect(screen.queryByRole('region', { name: 'Chosen' })).toBeNull()
      expect(screen.queryByRole('group', { name: /filter by show/i })).toBeNull()
      expect(screen.queryByText(/on sheet/i)).toBeNull()
      const card = screen.getByRole('button', { name: chassis.name })
      // A plain button: it opens the entity, it does not toggle a selection.
      expect(card.getAttribute('aria-pressed')).toBeNull()
      fireEvent.click(card)
      expect(opened).toEqual([chassis.id])
    },
    POOL_RENDER_MS
  )
})
