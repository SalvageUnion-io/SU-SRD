import { createFileRoute } from '@tanstack/react-router'
import { SettingsScreen } from '../build/account/SettingsScreen'
import { pageTitle } from '../lib/pageTitle'
import { routesCopy } from '../messages/routes'

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: pageTitle(routesCopy('settings')) }] }),
  component: SettingsScreen,
})
