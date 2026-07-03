import { createContext, useContext } from 'react'

import {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from './referenceEntityDisplayTypes'

/**
 * Display-state context for the entity display tree (audit item 20).
 *
 * `spacing`/`fontSize` are pure functions of `compact`, and `damaged`/
 * `disabled` are card-level flags — yet all four were threaded by hand
 * through every nested section component (~20 drilling sites), a recurring
 * regression source (a missed pass-through silently rendered the wrong
 * density). The card root (ReferenceEntityDisplayContent) now provides them
 * once; nested components consume with an explicit prop still winning:
 *
 *     prop ?? context ?? derived-from-compact default
 *
 * so every external caller that passes props keeps working, and components
 * rendered OUTSIDE a card (storybook, app one-offs) fall back to deriving
 * from their own `compact` prop exactly as before. Nested cards mount their
 * own provider, so inner compact cards never inherit outer full-card sizes.
 */
export type ReferenceEntityDisplayState = {
  compact: boolean
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  damaged: boolean
  disabled: boolean
}

const DisplayStateContext = createContext<ReferenceEntityDisplayState | undefined>(undefined)

/** Provided once per card by ReferenceEntityDisplayContent. */
export const ReferenceEntityDisplayStateProvider = DisplayStateContext.Provider

/** The nearest card's display state; undefined outside any card. */
export function useReferenceEntityDisplayContext(): ReferenceEntityDisplayState | undefined {
  return useContext(DisplayStateContext)
}

/** `prop ?? context ?? derive(compact)` for the spacing bundle. */
export function useDisplaySpacing(
  spacingProp: ReturnType<typeof getReferenceEntitySpacing> | undefined,
  compact: boolean
): ReturnType<typeof getReferenceEntitySpacing> {
  const ctx = useReferenceEntityDisplayContext()
  return spacingProp ?? ctx?.spacing ?? getReferenceEntitySpacing(compact)
}

/** `prop ?? context ?? derive(compact)` for the font-size bundle. */
export function useDisplayFontSize(
  fontSizeProp: ReturnType<typeof getReferenceEntityFontSizes> | undefined,
  compact: boolean
): ReturnType<typeof getReferenceEntityFontSizes> {
  const ctx = useReferenceEntityDisplayContext()
  return fontSizeProp ?? ctx?.fontSize ?? getReferenceEntityFontSizes(compact)
}
