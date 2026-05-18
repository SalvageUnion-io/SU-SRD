import { create } from 'zustand'

// Placeholder store — Wave 1 will introduce feature-specific stores.
// Example: appStore for UI state, characterStore for local character data.
type AppState = {
  initialized: boolean
  setInitialized: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (value) => set({ initialized: value }),
}))
