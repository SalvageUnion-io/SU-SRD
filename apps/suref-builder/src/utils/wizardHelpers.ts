import { useCallback } from 'react'

/**
 * Hook to create a setter function for a wizard state field
 * Reduces boilerplate in wizard state hooks
 *
 * @example
 * const setCallsign = useWizardSetter(setState, 'callsign')
 */
export function useWizardSetter<TState, TValue>(
  setState: React.Dispatch<React.SetStateAction<TState>>,
  fieldName: keyof TState
): (value: TValue) => void {
  return useCallback(
    (value: TValue) => {
      setState((prev) => ({ ...prev, [fieldName]: value }))
    },
    [setState, fieldName]
  )
}
