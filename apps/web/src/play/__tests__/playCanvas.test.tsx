/**
 * The canvas's two forms (ADR-045, play.md §11).
 *
 *  - The canvas never draws below its design size: its smallest text is the
 *    11px floor (ADR-045 decision 1), so any host under 1280 × 800 on either
 *    axis gets the phone form, a landscape phone and a short window too.
 *  - Browser zoom raises the floor, so a zoomed reader reaches it sooner,
 *    and the phone form's own scrollbar never reads as less zoom.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { PlayCanvas } from '../PlayCanvas'
import { canvasFit, isPhoneForm, layoutWidth, pageZoom } from '../playCanvas.model'
import { phoneViewport } from './phoneViewport'

describe('isPhoneForm — the canvas never draws its 11px text smaller (ADR-045 §1)', () => {
  test('a desktop window at or over the design size keeps the canvas', () => {
    expect(isPhoneForm(1280, 800)).toBe(false)
    expect(isPhoneForm(1440, 860)).toBe(false)
  })
  test('one px under the design size on either axis gets the phone form', () => {
    expect(isPhoneForm(1279, 900)).toBe(true)
    expect(isPhoneForm(1440, 799)).toBe(true)
  })
  test('a mid-size window and a tablet get it: the canvas would draw at 0.8 and 0.64', () => {
    expect(isPhoneForm(1024, 700)).toBe(true)
    expect(isPhoneForm(820, 1180)).toBe(true)
  })
  test('a portrait phone gets the phone form', () => {
    expect(isPhoneForm(375, 812)).toBe(true)
    expect(isPhoneForm(390, 844)).toBe(true)
  })
  test('a landscape phone gets it too', () => {
    expect(isPhoneForm(852, 393)).toBe(true)
  })
})

describe('canvasFit — the canvas fills its host edge to edge, never letterboxed (ADR-038 §9)', () => {
  test('a wide host keeps the scale its height allows and widens the canvas', () => {
    expect(canvasFit(1440, 800)).toEqual({ scale: 1, width: 1440, height: 800 })
    const fit = canvasFit(1920, 1000)
    expect(fit.scale).toBe(1.25)
    expect(fit.width).toBe(1536)
    expect(fit.height).toBe(800)
  })

  test('a tall host keeps the scale its width allows and lengthens the canvas', () => {
    expect(canvasFit(1280, 1024)).toEqual({ scale: 1, width: 1280, height: 1024 })
  })

  test('at its scale the canvas covers the host, within a pixel', () => {
    for (const [w, h] of [
      [1366, 900],
      [2560, 1300],
      [3840, 2160],
      [7680, 2160],
    ] as const) {
      const fit = canvasFit(w, h)
      expect(w - fit.width * fit.scale).toBeLessThan(fit.scale)
      expect(h - fit.height * fit.scale).toBeLessThan(fit.scale)
      expect(fit.width).toBeGreaterThanOrEqual(1280)
      expect(fit.height).toBeGreaterThanOrEqual(800)
    }
  })

  test('the scale is capped on a giant panel, and the canvas grows instead', () => {
    const fit = canvasFit(7680, 4320)
    expect(fit.scale).toBe(2.6)
    expect(fit.width).toBe(Math.floor(7680 / 2.6))
  })
})

describe('browser zoom raises the floor (ADR-045 §7)', () => {
  // A 2560×1440 desktop with ~1300px of viewport, at 100%, 125% and 150%:
  // zoom shrinks the CSS viewport, and the floor rises with the zoom.
  test('100% and 125% keep the canvas; 150% gets the phone form', () => {
    expect(isPhoneForm(2560, 1300, 1)).toBe(false)
    expect(isPhoneForm(2560 / 1.25, 1300 / 1.25, 1.25)).toBe(false)
    expect(isPhoneForm(2560 / 1.5, 1300 / 1.5, 1.5)).toBe(true)
  })
  test('without the zoom, the same 150% viewport would keep the canvas', () => {
    expect(isPhoneForm(2560 / 1.5, 1300 / 1.5)).toBe(false)
  })
  test('on a 1920×1080 desktop, 125% already gets it', () => {
    expect(isPhoneForm(1920, 970, 1)).toBe(false)
    expect(isPhoneForm(1920 / 1.25, 970 / 1.25, 1.25)).toBe(true)
  })
  test('zooming out never lowers the floor', () => {
    expect(isPhoneForm(852, 393, 0.5)).toBe(true)
  })
})

describe('pageZoom — the zoom, snapped to a step and normalised against the display density (ADR-045 §7)', () => {
  test('100% reads 1 on a 1x and a Retina screen', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1920 })).toBe(1)
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1440, viewportWidth: 1440 })).toBe(1)
  })
  test('150% reads 1.5 on a Retina screen, where devicePixelRatio alone reads 3', () => {
    expect(pageZoom({ devicePixelRatio: 3, outerWidth: 1440, viewportWidth: 960 })).toBe(1.5)
  })
  test('window chrome is not zoom: a frame or scrollbar a percent over reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1936, viewportWidth: 1905 })).toBe(1)
  })
  test('devicePixelRatio caps it: a side panel on a 1x screen is not zoom', () => {
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1400 })).toBe(1)
    // Even one that happens to land on a zoom step: density 1 / 1.25 is no screen.
    expect(pageZoom({ devicePixelRatio: 1, outerWidth: 1920, viewportWidth: 1536 })).toBe(1)
  })
  test('a side panel on a Retina screen is not zoom', () => {
    // A 14-inch MacBook Pro (1512px) with a 400px side panel reads 1.36: no step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 1112 })).toBe(1)
    // One that lands on 1.25 leaves a density of 1.6, which no screen ships with.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1440, viewportWidth: 1152 })).toBe(1)
    // A ~210px one lands on 1.15 and leaves 1.739, near 1.75 but not a quarter step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 1300 })).toBe(1)
  })
  test("so a 13-inch MacBook Air's sidebar raises no floor", () => {
    // 1470 / 1270 lands near the 1.15 step, but leaves a 1.739 density: no zoom.
    const zoom = pageZoom({ devicePixelRatio: 2, outerWidth: 1470, viewportWidth: 1270 })
    expect(zoom).toBe(1)
    expect(isPhoneForm(1280, 800, zoom)).toBe(false)
  })
  test('docked devtools on a Retina screen are not zoom', () => {
    // 600px of devtools on the same 1512px window reads 1.66: no step.
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 1512, viewportWidth: 912 })).toBe(1)
  })
  test('vertical tabs on a 125% Windows display are not zoom', () => {
    expect(pageZoom({ devicePixelRatio: 1.25, outerWidth: 1536, viewportWidth: 1280 })).toBe(1)
  })
  test('so a side panel beside a design-size canvas leaves it standing', () => {
    const zoom = pageZoom({ devicePixelRatio: 2, outerWidth: 1712, viewportWidth: 1312 })
    expect(zoom).toBe(1)
    expect(isPhoneForm(1312, 820, zoom)).toBe(false)
  })
  test('real zoom through a Windows frame and scrollbar still snaps to its step', () => {
    // A 125% display at 150% zoom: 1536px window plus a 16px frame, a 17px scrollbar.
    expect(pageZoom({ devicePixelRatio: 1.875, outerWidth: 1552, viewportWidth: 1012 })).toBe(1.5)
  })
  test('a browser that hides its zoom, or a reading of nothing, reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 960, viewportWidth: 960 })).toBe(1)
    expect(pageZoom({ devicePixelRatio: 2, outerWidth: 0, viewportWidth: 0 })).toBe(1)
  })
  test('zooming out reads 1', () => {
    expect(pageZoom({ devicePixelRatio: 1.8, outerWidth: 1440, viewportWidth: 1600 })).toBe(1)
  })
})

describe("the phone form's scrollbar does not flip the form back (ADR-045 §7)", () => {
  // A 1x 2560px display at 150% zoom with a 61px strip of vertical tabs: the
  // viewport is (2560 − 61) / 1.5 = 1666 CSS px, a 1.537 reading, near the
  // top of the 1.5 step's slack (1.545). The phone form scrolls, and its
  // 17px scrollbar takes 11 CSS px off `clientWidth`: 2560 / 1655 = 1.547.
  const OUTER = 2560
  const VIEWPORT = 1666
  const SCROLLBAR = 11

  test('clientWidth alone would read the zoom off the step once the scrollbar shows', () => {
    const reading = (viewportWidth: number) =>
      pageZoom({ devicePixelRatio: 1.5, outerWidth: OUTER, viewportWidth })
    expect(reading(VIEWPORT)).toBe(1.5)
    expect(reading(VIEWPORT - SCROLLBAR)).toBe(1)
    // layoutWidth counts the scrollbar, so both forms read the same zoom.
    expect(reading(layoutWidth(VIEWPORT - SCROLLBAR, VIEWPORT))).toBe(1.5)
  })

  test('a pinch-zoom, which shrinks innerWidth, does not move the reading', () => {
    expect(layoutWidth(1253, 835)).toBe(1253)
  })

  test('PlayCanvas settles on the phone form and stays there', () => {
    const phoneShowing = () => document.querySelector('.su-play-root--phone') !== null
    // Each width read past this many means the forms are flipping: fail
    // instead of looping forever.
    let reads = 0
    const width = () => {
      reads += 1
      if (reads > 40) throw new Error('Play flipped between its forms')
      return VIEWPORT - (phoneShowing() ? SCROLLBAR : 0)
    }
    const restore = phoneViewport({
      // innerWidth counts the scrollbar, so it holds in both forms.
      width: VIEWPORT,
      // 1000 / 800 = 1.25 (and 1655 / 1280 = 1.29): under 1.5, over 1 alone.
      height: 1000,
      hostWidth: width,
      devicePixelRatio: 1.5,
      outerWidth: OUTER,
    })
    try {
      const formChanges: string[] = []
      const Form = ({ name }: { name: string }) => {
        formChanges.push(name)
        return <div>{name}</div>
      }
      const view = render(
        <PlayCanvas phone={<Form name="phone" />}>
          <Form name="canvas" />
        </PlayCanvas>
      )
      expect(phoneShowing()).toBe(true)
      expect(view.queryByText('canvas')).toBeNull()
      // The scrollbar's arrival re-measured the phone form and kept it.
      expect(formChanges.filter((f) => f === 'canvas').length).toBeLessThanOrEqual(1)
      expect(formChanges.at(-1)).toBe('phone')
      view.unmount()
    } finally {
      restore()
    }
  })
})
