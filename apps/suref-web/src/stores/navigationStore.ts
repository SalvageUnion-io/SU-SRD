import { create } from 'zustand'

interface NavigationState {
  isMenuOpen: boolean
  signingOut: boolean
  toggleMenu: () => void
  openMenu: () => void
  closeMenu: () => void
  setSigningOut: (value: boolean) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  isMenuOpen: false,
  signingOut: false,
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  setSigningOut: (value) => set({ signingOut: value }),
}))
