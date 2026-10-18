/**
 * EntitySearcher — browse mode: a reference browser, not a picker (the
 * Play's SRD Explorer). Its own file, like the other modes, so the
 * parallel runner can spread the pool renders over its workers.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { POOL_RENDER_MS } from './entitySearcherHarness'

describe('EntitySearcher — browse mode', () => {
  it(
    'has no rail, no boxes and no Show facet; a Token click opens it',
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
      expect(screen.queryByRole('region', { name: /chosen/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /^select /i })).toBeNull()
      // Folded rows are still in the DOM, so this sees past Filters.
      expect(document.body.textContent).not.toContain('Chosen only')
      const token = screen.getByRole('button', { name: chassis.name })
      // A plain button: it opens the entity, it does not toggle a selection.
      expect(token.getAttribute('aria-pressed')).toBeNull()
      fireEvent.click(token)
      expect(opened).toEqual([chassis.id])
    },
    POOL_RENDER_MS
  )
})
