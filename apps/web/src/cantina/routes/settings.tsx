import { createFileRoute } from '@tanstack/react-router'
import { SettingsScreen } from '../components/account/SettingsScreen'
import { pageTitle } from '../lib/pageTitle'

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: pageTitle('Settings') }] }),
  component: SettingsScreen,
})
