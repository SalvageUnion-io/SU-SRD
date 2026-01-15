import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'

const MechEdit = lazy(() =>
  import('../../../components/Dashboard/MechEdit').then((m) => ({ default: m.MechEdit }))
)

export const Route = createFileRoute('/dashboard/mechs/$id')({
  component: MechEdit,
  staticData: {
    ssr: false,
  },
})
