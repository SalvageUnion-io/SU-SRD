import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MechBuilder } from '../../components/mech/MechBuilder'

export const Route = createFileRoute('/mechs/new')({
  component: MechNewPage,
})

function MechNewPage() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto max-w-4xl p-6">
      <MechBuilder
        onSuccess={() => {
          void navigate({ to: '/' })
        }}
      />
    </main>
  )
}
