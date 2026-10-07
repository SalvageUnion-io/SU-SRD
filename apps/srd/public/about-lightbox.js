// The /about page's Eldridge Coast lightbox: the map link opens the native
// `<dialog>`; the close button and a backdrop click close it and return focus to
// the link. Loaded by URL from `src/pages/about.page.tsx`, never inlined — srd
// emits no executable inline script, so its CSP `script-src` stays a literal.
const mapLink = document.getElementById('map-link')
const modal = document.getElementById('image-modal')
const closeBtn = document.getElementById('close-modal')

mapLink?.addEventListener('click', (e) => {
  e.preventDefault()
  modal?.showModal()
})
closeBtn?.addEventListener('click', () => {
  modal?.close()
  mapLink?.focus()
})
modal?.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.close()
    mapLink?.focus()
  }
})
