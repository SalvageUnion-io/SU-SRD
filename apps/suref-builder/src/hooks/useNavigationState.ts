import { useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { signOut } from '../lib/api'
import { logger } from 'suref-react'
import { useNavigationStore } from '../stores/navigationStore'

/**
 * Shared navigation state and handlers
 * Consolidates common navigation logic for TopNavigation
 */
export function useNavigationState() {
  const navigate = useNavigate()
  const location = useLocation()

  // Use Zustand store for shared state
  const isOpen = useNavigationStore((state) => state.isMenuOpen)
  const signingOut = useNavigationStore((state) => state.signingOut)
  const toggleMenu = useNavigationStore((state) => state.toggleMenu)
  const closeMenu = useNavigationStore((state) => state.closeMenu)
  const setSigningOut = useNavigationStore((state) => state.setSigningOut)

  const handleNavigate = useCallback(
    (path: string) => {
      navigate({ to: path })
      closeMenu()
    },
    [navigate, closeMenu]
  )

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true)
      await signOut()
    } catch (error) {
      logger.error('Error signing out:', error)
    } finally {
      setSigningOut(false)
    }
  }, [setSigningOut])

  const isActive = useCallback(
    (path: string, exact = false) => {
      if (exact) {
        return location.pathname === path
      }
      return location.pathname.startsWith(path)
    },
    [location.pathname]
  )

  return {
    isOpen,
    signingOut,
    handleNavigate,
    handleSignOut,
    isActive,
    toggleMenu,
    location,
  }
}
