/**
 * The home's slideshow Pause (`HomeHero`, WCAG 2.2.2): the server draws it
 * hidden, a `Toggle` at rest; this shows it and makes it one. Pressed, it
 * holds the show (`[data-paused]`, `front.css`) and wears the Toggle's
 * pressed ink plate. Plain DOM: the page loads no React.
 */
export function watchSlideshow(root: ParentNode): void {
  for (const show of root.querySelectorAll<HTMLElement>('.su-front__show')) {
    const pause = show.querySelector<HTMLButtonElement>('[data-show-pause]')
    if (!pause) continue
    pause.hidden = false
    pause.addEventListener('click', () => {
      const paused = pause.getAttribute('aria-pressed') !== 'true'
      pause.setAttribute('aria-pressed', String(paused))
      pause.classList.toggle('su-btn--ink', paused)
      pause.classList.toggle('su-btn--default', !paused)
      show.toggleAttribute('data-paused', paused)
    })
  }
}
