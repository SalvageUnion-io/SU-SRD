import { createFileRoute } from '@tanstack/react-router'
import { HydratedPatternDisplay } from '../../../components/patterns/HydratedPatternDisplay'

export const Route = createFileRoute('/_authenticated/patterns/$patternId')({
  component: EditPatternPage,
})

function EditPatternPage() {
  const { patternId } = Route.useParams()
  return <HydratedPatternDisplay patternId={patternId} />
}
