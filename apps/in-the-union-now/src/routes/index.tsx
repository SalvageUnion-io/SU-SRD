import { createFileRoute } from '@tanstack/react-router'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">ITUN v2 — Wave 0 scaffold</h1>
      <p className="text-sm opacity-70">
        Local-first character builder. Wave 1 features coming next.
      </p>
      <Button variant="outline">Get started</Button>
    </main>
  )
}
