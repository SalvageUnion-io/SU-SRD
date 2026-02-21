import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ErrorFallback } from '../../../components/shared/ErrorFallback'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId')({
  errorComponent: ErrorFallback,
  component: () => <Outlet />,
})
