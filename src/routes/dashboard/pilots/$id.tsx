import { lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const PilotEdit = lazy(() =>
  import('../../../components/Dashboard/PilotEdit').then((m) => ({ default: m.PilotEdit }))
)

const pilotSearchSchema = z.object({
  new: z.union([z.string(), z.boolean()]).optional(),
})

export const Route = createFileRoute('/dashboard/pilots/$id')({
  component: PilotEdit,
  validateSearch: pilotSearchSchema,
  staticData: {
    ssr: false,
  },
})
