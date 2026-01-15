import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { signOut } from '../lib/api'
import { logger } from '../lib/logger'

/**
 * Shared navigation state and handlers
 * Consolidates common navigation logic for TopNavigation
 */
export function useNavigationState() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleNavigate = useCallback(
    (path: string) => {
      navigate({ to: path })
      setIsOpen(false)
    },
    [navigate]
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
  }, [])

  const isActive = useCallback(
    (path: string, exact = false) => {
      if (exact) {
        return location.pathname === path
      }
      return location.pathname.startsWith(path)
    },
    [location.pathname]
  )

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

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
