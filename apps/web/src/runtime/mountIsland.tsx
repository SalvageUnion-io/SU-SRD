/**
 * mountIsland — put one island into its placeholder in a single step, and keep
 * what the reader was doing in the server markup it replaces.
 *
 * Two things went wrong when the mounter emptied the placeholder itself
 * (`replaceChildren()`) and then called `createRoot`:
 *
 * - **A flash.** The placeholder sat empty from the clear until React's first
 *   commit. React already clears a root's container in that commit ("the first
 *   time you call `root.render`, React will clear all the existing HTML content
 *   inside the React root"), so the server markup now stays on screen until the
 *   island's own markup replaces it, in one step.
 * - **Lost input and focus.** A reader who had clicked into the server-rendered
 *   hero search and started typing before the island mounted lost the text, and
 *   focus fell to `<body>` (WCAG 2.4.3, 3.2.2). The form state is now read just
 *   before the swap and put back on the island's controls of the same `name`
 *   just after it.
 */

import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useState } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot, hydrateRoot } from 'react-dom/client'
import type { IslandComponent } from './islandRegistry'

/** The text-entry `<input>` types whose value and caret are worth carrying. */
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'number'])

type TextControl = HTMLInputElement | HTMLTextAreaElement

/** The form state of a placeholder, keyed by each control's `name`. */
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
 * The island's outermost element. Its first render runs in the same task as
 * the root's first commit, so the capture reads the server markup as the
 * reader left it, the moment before React clears it.
 */
function CarryFormState({ container, children }: CarryFormStateProps) {
  const [carried] = useState(() => captureFormState(container))
  useLayoutEffect(() => {
    // After the commit, not inside it: an `input` event dispatched during a
    // commit cannot flush React's state, and React would put the controlled
    // input back to its old value.
    queueMicrotask(() => restoreFormState(container, carried))
  }, [container, carried])
  return children
}

/**
 * Calls `onCommit` once the island's first commit is on the page, and after
 * any layout-effect work queued in it (`CarryFormState`'s restore): the
 * moment a held gesture can be played back on controls that now listen.
 * Renders no element of its own, so it cannot change what a hydrating island
 * has to match.
 */
function AfterFirstCommit({ onCommit, children }: { onCommit: () => void; children: ReactNode }) {
  const [callback] = useState(() => onCommit)
  useEffect(() => {
    const timer = setTimeout(callback, 0)
    return () => clearTimeout(timer)
  }, [callback])
  return children
}

export type MountOptions = {
  /**
   * Adopt the server markup instead of replacing it (`hydrateRoot`): for an
   * island whose server markup is exactly its own first render from the same
   * props, and which reads no game data (`<Island hydrate>`).
   */
  hydrate?: boolean
  /** Runs once the first commit is on the page (`AfterFirstCommit`). */
  onCommit?: () => void
}

/**
 * Mounts `Component` into `el`: replacing its server markup in one commit, or,
 * with `hydrate`, adopting it, so nothing on the page is drawn twice.
 */
export function mountIsland(
  el: HTMLElement,
  Component: IslandComponent,
  props: Record<string, unknown>,
  { hydrate = false, onCommit }: MountOptions = {}
): Root {
  const island = onCommit ? (
    <AfterFirstCommit onCommit={onCommit}>
      <Component {...props} />
    </AfterFirstCommit>
  ) : (
    <Component {...props} />
  )
  if (hydrate) return hydrateRoot(el, island)
  const root = createRoot(el)
  root.render(<CarryFormState container={el}>{island}</CarryFormState>)
  return root
}
