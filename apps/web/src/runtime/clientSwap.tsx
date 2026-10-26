/**
 * clientSwap — an island that the browser draws for itself, over a server
 * stand-in, in one step, keeping what the reader was doing in it.
 *
 * Astro hydrates every island (`client:*`, `@astrojs/react`). Most of ours
 * cannot be hydrated as they are: `useGameData`'s server snapshot is `false`,
 * so a card's first client render is not the one the server drew, and a
 * listing's server markup is a stand-in (`SchemaViewerListing`), not the
 * island. So the hydrated component is this wrapper. Server and hydration
 * both render the stand-in Astro passes as `children` (its slot, which the
 * client is handed back verbatim), so hydration has nothing to mismatch; the
 * wrapper then waits for what the island's first render needs (`prepare`)
 * and swaps the island in.
 *
 * The swap keeps the reader's place: text typed into a named field of the
 * stand-in is carried onto the island's field of the same `name`, with its
 * caret and focus (WCAG 2.4.3, 3.2.2). Once the island's first commit is on
 * the page it says so (`ISLAND_COMMIT`), so the `interaction` directive can
 * play back a press that landed on the stand-in.
 */

import type { ComponentType, ReactNode } from 'react'
import { isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ISLAND_COMMIT } from './islandCommit'

/** The text-entry `<input>` types whose value and caret are worth carrying. */
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'number'])

type TextControl = HTMLInputElement | HTMLTextAreaElement

/** The form state of a stand-in, keyed by each control's `name`. */
export type CarriedFormState = {
  /** Values the reader changed (value differs from the markup's default). */
  values: Map<string, string>
  /** The control that had focus, with its selection when it has one. */
  focus: {
    name: string
    start: number | null
    end: number | null
    direction: 'forward' | 'backward' | 'none' | null
  } | null
}

function isTextControl(node: unknown): node is TextControl {
  if (node instanceof HTMLTextAreaElement) return node.name !== ''
  return node instanceof HTMLInputElement && node.name !== '' && TEXT_TYPES.has(node.type)
}

function findControl(container: HTMLElement, name: string): TextControl | undefined {
  for (const node of container.querySelectorAll('input[name], textarea[name]')) {
    if (isTextControl(node) && node.name === name) return node
  }
  return undefined
}

/** Reads the named text controls inside `container`, and which one has focus. */
export function captureFormState(container: HTMLElement): CarriedFormState {
  const values = new Map<string, string>()
  for (const node of container.querySelectorAll('input[name], textarea[name]')) {
    if (isTextControl(node) && node.value !== node.defaultValue && !values.has(node.name)) {
      values.set(node.name, node.value)
    }
  }
  const active = document.activeElement
  const focus =
    isTextControl(active) && container.contains(active)
      ? {
          name: active.name,
          start: active.selectionStart,
          end: active.selectionEnd,
          direction: active.selectionDirection,
        }
      : null
  return { values, focus }
}

/**
 * Sets a control's value the way typing does, so a controlled React input sees
 * it: through the prototype's setter (React's value tracker wraps the
 * instance's), then an `input` event, which React's `onChange` listens for.
 */
function typeValue(control: TextControl, value: string): void {
  const proto =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(control, value)
  control.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Puts `state` back on the controls of the same name inside `container`. */
export function restoreFormState(container: HTMLElement, state: CarriedFormState): void {
  for (const [name, value] of state.values) {
    const control = findControl(container, name)
    if (control && control.value !== value) typeValue(control, value)
  }
  if (!state.focus) return
  // Only where the swap dropped it: a reader who has since moved on keeps focus.
  const active = document.activeElement
  if (active && active !== document.body) return
  const control = findControl(container, state.focus.name)
  if (!control) return
  control.focus({ preventScroll: true })
  const { start, end, direction } = state.focus
  if (start === null || end === null) return
  try {
    control.setSelectionRange(start, end, direction ?? undefined)
  } catch {
    // A control whose type has no selection API (`email`, `number`) keeps the
    // browser's caret; focus is what matters.
  }
}

type CarryFormStateProps = { container: HTMLElement; children: ReactNode }

/**
 * The island's first render. It reads the stand-in's form state in the same
 * render (and so the same task) as the commit that replaces it, so nothing a
 * reader types can land between the two.
 */
function CarryFormState({ container, children }: CarryFormStateProps) {
  const [carried] = useState(() => captureFormState(container))
  useLayoutEffect(() => {
    // After the commit, not inside it: an `input` event dispatched during a
    // commit cannot flush React's state, and React would put the controlled
    // input back to its old value.
    queueMicrotask(() => restoreFormState(container, carried))
  }, [container, carried])
  // After the island's own effects too, so a played-back press or hover
  // meets listeners the island attached in them (the Peek's).
  useEffect(() => {
    const timer = setTimeout(
      () => container.dispatchEvent(new Event(ISLAND_COMMIT, { bubbles: true })),
      0
    )
    return () => clearTimeout(timer)
  }, [container])
  return children
}

type SwapOptions<P> = {
  /** What the island's first render needs, fetched before the swap (its schemas). */
  prepare?: (props: P) => Promise<void>
}

/**
 * The hydrated form of island `View`, named `name` on its element
 * (`data-island`): the stand-in until the browser has what `View` needs, then
 * `View` itself.
 */
export function clientSwap<P extends object>(
  name: string,
  View: ComponentType<P>,
  { prepare }: SwapOptions<P> = {}
) {
  function Swapped({ children, ...props }: P & { children?: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const [ready, setReady] = useState(false)

    // biome-ignore lint/correctness/useExhaustiveDependencies: once, after hydration; the props are the server's
    useEffect(() => {
      let live = true
      void Promise.resolve(prepare?.(props as P)).then(() => {
        if (live) setReady(true)
      })
      return () => {
        live = false
      }
    }, [])

    // The same element before and after, so the swap keeps it and replaces
    // only what is inside it.
    const el = ref.current
    if (ready && el) {
      return (
        <div ref={ref} data-island={name}>
          <CarryFormState container={el}>
            <View {...(props as P)} />
          </CarryFormState>
        </div>
      )
    }
    // The stand-in is Astro's slot; an island with none draws nothing until the swap.
    return (
      <div ref={ref} data-island={name} data-standin="">
        {isValidElement(children) ? children : null}
      </div>
    )
  }
  Swapped.displayName = name
  return Swapped
}
