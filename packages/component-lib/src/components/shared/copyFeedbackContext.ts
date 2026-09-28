import { createContext, useContext } from 'react'

/**
 * Tells the user a copy to the clipboard succeeded. How is the app's call:
 * ITUN raises a toast, srd mounts no toaster and provides nothing. A context
 * rather than a prop because a RollTable can sit several entity cards deep.
 */
export type CopyFeedback = () => void

const CopyFeedbackContext = createContext<CopyFeedback | undefined>(undefined)

/** Provide the app's copy confirmation to every nested RollTable. */
export const CopyFeedbackProvider = CopyFeedbackContext.Provider

/** The provided copy confirmation, or undefined when the app gives none. */
export function useCopyFeedback(): CopyFeedback | undefined {
  return useContext(CopyFeedbackContext)
}
