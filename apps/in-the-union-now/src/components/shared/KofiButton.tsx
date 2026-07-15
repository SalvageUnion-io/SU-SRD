/**
 * KofiButton — a "Support me on Ko-fi" link, rendered as a native styled anchor
 * to ko-fi.com/C3Z82382ZC.
 *
 * NOT the Ko-fi widget (storage.ko-fi.com/.../Widget_2.js): the app's CSP
 * (`script-src 'self' 'unsafe-inline'`, netlify.toml) blocks external scripts,
 * so we reproduce the widget's look (Ko-fi blue #72a4f2, cup + label) as a
 * plain link that works offline and inside the CSP.
 */

const KOFI_BLUE = '#72a4f2'
const KOFI_URL = 'https://ko-fi.com/C3Z82382ZC'

export function KofiButton() {
  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{ backgroundColor: KOFI_BLUE }}
      className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-cond text-sm font-semibold uppercase tracking-caps-snug text-white no-underline shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange"
    >
      <span aria-hidden="true">☕</span>
      Support me on Ko-fi
    </a>
  )
}
