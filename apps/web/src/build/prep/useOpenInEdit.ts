/**
 * Opened from a Game's Prep, an encounter or an NPC opens in Edit (r7 C13,
 * MD7-19): from Prep the Mediator is there to change it. Prep's links carry
 * `?edit=1`; the sheet's route reads it (`editSearch`) and turns Edit on as it
 * opens (`useOpenInEdit`). The sheet's way back is already its Game's Prep.
 */

import { useEffect } from 'react'
import { useSheetModeStore } from '../sheet/sheetMode.model'

/** A sheet's address as Prep links it: opening in Edit. */
export function inEdit(href: string): string {
  return `${href}?edit=1`
}

/** The route's search: `edit` when a Prep link opened it. */
export function editSearch(search: Record<string, unknown>): { edit?: true } {
  return search.edit === undefined || search.edit === false ? {} : { edit: true }
}

/** Turn Edit on as the sheet opens, when its link asked. */
export function useOpenInEdit(edit: boolean | undefined): void {
  useEffect(() => {
    if (edit === true) useSheetModeStore.getState().setEditing(true)
  }, [edit])
}
