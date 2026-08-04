import { useEffect, useRef } from 'react'
import { cn } from '../../utils/cn'

/**
 * KofiButton — the official Ko-fi "Support me on Ko-fi" widget button.
 *
 * Loads Ko-fi's Widget_2.js and injects the button markup via the widget's
 * `getHTML()` — deliberately NOT its `draw()`, which uses `document.write` and
 * would blow away the page when it runs after load. `getHTML()` works the same
 * in a React SPA (itun) and under Astro's client-side router
 * (srd re-hydrates this island on navigation), where a `document.write`
 * would be fatal.
 *
 * Progressive enhancement: the container renders a plain accessible link to
 * ko-fi.com up front; the widget replaces it once the script loads. If the
 * script is blocked or fails, the plain link remains — nothing breaks.
 *
 * Requires the host CSP to allow `script-src https://storage.ko-fi.com`
 * (the button image is served from the same host, covered by `img-src https:`).
 * See each app's `netlify.toml`.
 */

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
  /** Button label. */
  label?: string
  /** Button accent colour (hex). */
  color?: string
  /** Optional class on the container element. */
  className?: string
}

export function KofiButton({
  code,
  label = 'Support me on Ko-fi',
  color = '#72a4f2',
  className,
}: KofiButtonProps) {
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
    fallback.textContent = label
    el.appendChild(fallback)

    function render() {
      if (cancelled || !ref.current) return
      const widget = window.kofiwidget2
      if (!widget) return
      widget.init(label, color, code)
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
  }, [code, label, color])

  return <div ref={ref} className={cn('inline-block', className)} />
}
