/**
 * The cut-out law's render check (`_cutouts.ts`) on hand-made readings: a
 * cut-out on its strip's foot passes; one floated off it fails, with the fix.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { CutoutRead } from '../_cutouts'
import { CUTOUT_FIX, findCutoutFaults, findCutouts } from '../_cutouts'
import { documentPage } from './_page'

const read = (off: number): CutoutRead => ({ what: 'ledger col', label: 'Slots', off })

describe('the cut-out law at render', () => {
  test('a cut-out on its foot passes, sub-pixel rounding with it', () => {
    expect(findCutoutFaults([read(0), read(0.6), read(-1)])).toEqual([])
  })

  test('a cut-out floated off its foot fails, naming it and printing the fix', () => {
    expect(findCutoutFaults([read(3)])).toEqual([
      `foot: ledger col "Slots" 3.0px off its strip's foot (${CUTOUT_FIX})`,
    ])
  })

  test('one hanging below its foot fails too', () => {
    expect(findCutoutFaults([read(-2.2)])).toHaveLength(1)
  })
})

describe('the cut-out reader', () => {
  const { page, restore } = documentPage()
  afterAll(restore)
  const details = async () =>
    (await findCutouts(page)).map((finding) => finding.detail.split(' (')[0])

  test('a Ledger and a sheet table: flush cut-outs pass, a floated one is named', async () => {
    document.body.innerHTML = `
      <table><thead><tr class="su-ledger__head" data-box="0,0,600,40">
        <th><span class="su-entity-compact__notch" data-box="0,16,80,24">Systems</span></th>
        <th><span class="su-badge--stamp-solid" data-box="100,20,40,20">Slots</span></th>
        <th><span class="su-badge--stamp-solid" data-box="160,17,40,20">SV</span></th>
      </tr></thead></table>
      <table class="su-open"><thead><tr data-box="0,100,600,40">
        <th><span class="su-open__title"><span class="su-rule-head__label" data-box="0,116,80,24">Inventory</span></span></th>
        <th><span class="su-open__col-tab" data-box="100,117,40,20">TL</span></th>
      </tr></thead></table>`
    expect(await details()).toEqual([
      `foot: ledger col "SV" 3.0px off its strip's foot`,
      `foot: table col "TL" 3.0px off its strip's foot`,
    ])
  })

  test("a band's paper label is read, a plain ruled label and a hidden band are not", async () => {
    document.body.innerHTML = `
      <div class="su-rule-head" data-box="0,0,600,34">
        <h2 class="su-rule-head__label" style="background-color: white" data-box="0,4,80,24">Training</h2>
      </div>
      <div class="su-rule-head" data-box="0,100,600,34">
        <h2 class="su-rule-head__label" data-box="0,104,80,24">Pre-Session</h2>
      </div>
      <div class="su-rule-head" style="display: none" data-box="0,200,600,34">
        <h2 class="su-rule-head__label" style="background-color: white" data-box="0,204,80,24">Hidden</h2>
      </div>`
    expect(await details()).toEqual([`foot: band "Training" 6.0px off its strip's foot`])
  })

  test("a band's cut-out wears its body's ground: paper over paper passes, paper over the page fails", async () => {
    document.body.innerHTML = `
      <section style="background-color: rgb(239, 236, 230)">
        <div class="su-rule-head" data-box="0,0,600,34">
          <h2 class="su-rule-head__label" style="background-color: rgb(251, 250, 247)" data-box="0,10,80,24">Crew</h2>
        </div>
        <div style="background-color: rgb(251, 250, 247)" data-box="0,34,600,100">rows</div>
      </section>
      <section style="background-color: rgb(239, 236, 230)">
        <div class="su-rule-head" data-box="0,200,600,34">
          <h2 class="su-rule-head__label" style="background-color: rgb(251, 250, 247)" data-box="0,210,80,24">Starter Set</h2>
        </div>
        <p data-box="0,246,600,20">On the page's ground.</p>
      </section>`
    expect(await details()).toEqual([
      'ground: band "Starter Set" rgb(251, 250, 247) over a rgb(239, 236, 230) body',
    ])
  })

  test("the home: the name hangs from the show's top, the slide in view stands on its foot", async () => {
    document.body.innerHTML = `
      <section class="su-front__show" data-box="0,56,1440,600">
        <ul>
          <li class="su-front__show-slide"><div class="su-front__show-copy" data-box="900,600,400,56">Know the rules</div></li>
          <li class="su-front__show-slide" style="visibility: hidden"><div class="su-front__show-copy" data-box="900,500,400,56">Faded</div></li>
        </ul>
        <h1 class="su-front__show-name" data-box="80,56,500,74">SalvageUnion.io</h1>
      </section>`
    expect(await details()).toEqual([])
    document.querySelector('.su-front__show-name')?.setAttribute('data-box', '80,80,500,74')
    expect(await details()).toEqual([`foot: home "SalvageUnion.io" 24.0px off its strip's foot`])
  })
})
