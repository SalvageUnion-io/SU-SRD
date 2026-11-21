/**
 * The action bar's prompt (r2 H1): the one line over the Next that says what
 * the step still asks for, or offers out of sight. A press brings that thing
 * to the reader, its top first where it is too tall to centre (centring a
 * long list opens on its middle, past its heading); and the line leaves once
 * pressed, and while the thing it points at is already on screen.
 */
import { useEffect, useState } from 'react'

/** The first table the step asks a first Ability from (`ClassAbilityStep`). */
export const FIRST_ABILITY_ID = 'wiz-first-ability'

/** Top first when the target takes more than half the screen, else centred. */
export function scrollBlockFor(targetHeight: number, viewportHeight: number): 'start' | 'center' {
  return targetHeight > viewportHeight / 2 ? 'start' : 'center'
}

/** Bring the prompt's target to the reader. */
export function scrollToAsked(target: Element): void {
  target.scrollIntoView({
    behavior: 'smooth',
    block: scrollBlockFor(target.getBoundingClientRect().height, window.innerHeight),
  })
}

/** Whether to say the prompt: not once pressed, and not while its target shows. */
export function promptShows(args: { key: string; used: string | null; inView: boolean }): boolean {
  return args.key !== args.used && !args.inView
}

/**
 * Whether the element with `id` is on screen. False where nothing can tell
 * (no `IntersectionObserver`: a test's DOM), so the prompt is said.
 */
export function useInView(id: string | undefined): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    setInView(false)
    const target = id ? document.getElementById(id) : null
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? false)
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [id])
  return inView
}
