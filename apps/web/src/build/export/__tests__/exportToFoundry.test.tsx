/**
 * Export to Foundry VTT from a sheet: the unit downloads as an Actor file
 * named for it, and a toast says how to bring it in. The download is observed
 * through the two browser calls `downloadJson` makes, restored after each test.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { ToasterMount, toast } from '../../../components/index'
import { exportToFoundry } from '../exportToFoundry.model'

type Download = { filename: string; blob: Blob }
let downloads: Download[] = []
let lastBlob: Blob | null = null

const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL
const realClick = HTMLAnchorElement.prototype.click

beforeEach(() => {
  downloads = []
  lastBlob = null
  URL.createObjectURL = (blob: Blob) => {
    lastBlob = blob
    return 'blob:test'
  }
  URL.revokeObjectURL = () => {}
  HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    if (lastBlob !== null) downloads.push({ filename: this.download, blob: lastBlob })
  }
  toast.dismiss()
})

afterEach(() => {
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
  HTMLAnchorElement.prototype.click = realClick
  toast.dismiss()
})

async function actor(): Promise<{ name: string; type: string }> {
  const [download] = downloads
  if (download === undefined) throw new Error('nothing was downloaded')
  return JSON.parse(await download.blob.text()) as { name: string; type: string }
}

/** Let the toast land. */
async function said(text: string): Promise<HTMLElement> {
  for (let i = 0; i < 40 && screen.queryByText(text) === null; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
  return screen.getByText(text)
}

describe('Export to Foundry VTT', () => {
  test('a pilot downloads as a Pilot actor, and the toast says to import it into an empty Pilot', async () => {
    render(<ToasterMount />)
    await act(async () => {
      exportToFoundry({
        kind: 'pilot',
        entity: pilotFixture({ id: 'p1', name: 'Rosa Vance', callsign: 'Bonesaw' }),
        crawler: null,
      })
    })
    expect(downloads.map((d) => d.filename)).toEqual(['fvtt-salvage-union-pilot-rosa-vance.json'])
    expect(await actor()).toMatchObject({ type: 'pilot' })
    expect(
      await said('Exported Rosa Vance. In Foundry, make an empty Pilot and choose Import Data.')
    ).toBeTruthy()
  })

  test('a mech downloads as a Mech actor', async () => {
    render(<ToasterMount />)
    await act(async () => {
      exportToFoundry({
        kind: 'mech',
        entity: mechFixture({ id: 'm1', name: 'Old Faithful', chassisRef: 'mule' }),
        pilotAbilities: undefined,
      })
    })
    expect(downloads.map((d) => d.filename)).toEqual(['fvtt-salvage-union-mech-old-faithful.json'])
    expect(await actor()).toMatchObject({ type: 'mech', name: 'Old Faithful' })
    expect(
      await said('Exported Old Faithful. In Foundry, make an empty Mech and choose Import Data.')
    ).toBeTruthy()
  })
})
