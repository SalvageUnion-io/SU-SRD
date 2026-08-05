import { createFileRoute } from '@tanstack/react-router'
import { AccountScreen } from '../components/account/AccountScreen'

export const Route = createFileRoute('/account')({
  component: AccountScreen,
})
