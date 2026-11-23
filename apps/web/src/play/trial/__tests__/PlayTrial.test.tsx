/**
 * The trial says from its first screen that nothing is kept (r7 F2, SB7-02),
 * and offers only what it plays: no Downtime (r7 F3, SB7-03).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import { playCopy } from '../../../messages/play'
import { playTrialCopy } from '../../../messages/play-trial'
import { resetSync } from '../../../replica/sync'
import { useScreenNotices } from '../../tableStripSlot.model'
import { PlayTrial } from '../PlayTrial'

afterEach(() => resetSync())

function StripTitles() {
  const notices = useScreenNotices()
  return <output aria-label="strip">{notices.map((n) => n.title).join('|')}</output>
}

describe('the trial', () => {
  test('says nothing is kept before any change, and has no Downtime', async () => {
    await hydrateStores()
    await act(async () => {
      render(
        <>
          <StripTitles />
          <PlayTrial id="starter-pilot-bonesaw" refusal={null} />
        </>
      )
    })
    expect(screen.getByLabelText('strip').textContent).toBe(playTrialCopy('nothingIsKept'))
    expect(screen.queryByRole('button', { name: playCopy('downtimeWord') })).toBeNull()
  })
})
