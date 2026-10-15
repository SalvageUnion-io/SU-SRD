import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

/**
 * KofiButton — the official Ko-fi "Support me on Ko-fi" widget button.
 *
 * Loads Ko-fi's Widget_2.js and injects the button markup via the widget's
 * `getHTML()` — deliberately NOT its `draw()`, which uses `document.write` and
 * would blow away the page when it runs after load. `getHTML()` works the same
 * in a React SPA (cantina) and in an srd island mounted after load, where a
 * `document.write` would be fatal.
 *
 * Progressive enhancement: the container renders a plain accessible link to
 * ko-fi.com up front; the widget replaces it once the script loads. If the
 * script is blocked or fails, the plain link remains — nothing breaks.
 *
 * Requires the host CSP to allow `script-src https://storage.ko-fi.com`
 * (the button image is served from the same host, covered by `img-src https:`).
 * See each app's `public/_headers`.
 */

const CONTAINER = { display: 'inline-block' } satisfies CSSProperties

const WIDGET_SRC = 'https://storage.ko-fi.com/cdn/widget/Widget_2.js'

type KofiWidget = {
  init: (text: string, color: string, id: string) => void
  getHTML: () => string
  draw: () => void
}

declare global {
  interface Window {
    kofiwidget2?: KofiWidget
  }
}

export type KofiButtonProps = {
  /** Ko-fi page code — the `<code>` in `ko-fi.com/<code>`. */
  code: string
}

const LABEL = 'Support me on Ko-fi'

/**
 * The button's accent colour (hex). The widget sets its label in white on this,
 * so it is dark enough for WCAG AA: 5.5:1, where the `#72a4f2` it replaced
 * measured 2.5:1.
 */
const ACCENT = '#2e66c4'

export function KofiButton({ code }: KofiButtonProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof document === 'undefined') return

    let cancelled = false

    // Accessible fallback until (or unless) the widget script renders.
    el.textContent = ''
    const fallback = document.createElement('a')
    fallback.href = `https://ko-fi.com/${code}`
    fallback.target = '_blank'
    fallback.rel = 'noopener noreferrer'
    fallback.textContent = LABEL
    el.appendChild(fallback)

    function render() {
      if (cancelled || !ref.current) return
      const widget = window.kofiwidget2
      if (!widget) return
      widget.init(LABEL, ACCENT, code)
      ref.current.innerHTML = widget.getHTML()
    }

    if (window.kofiwidget2) {
      render()
      return () => {
        cancelled = true
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`)
    const script = existing ?? document.createElement('script')
    if (!existing) {
      script.src = WIDGET_SRC
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', render)

    return () => {
      cancelled = true
      script.removeEventListener('load', render)
    }
  }, [code])

  return <div ref={ref} style={CONTAINER} />
}
