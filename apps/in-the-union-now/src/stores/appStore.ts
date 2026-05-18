/**
 * appStore — lightweight Wave 0 app-initialization flag.
 * Kept to avoid breaking existing consumers (scaffold test, future code).
 */
import { create } from 'zustand'

type AppState = {
  initialized: boolean
  setInitialized: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (value) => set({ initialized: value }),
}))
