import { useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'

type NotFoundStateProps = {
  message: string
  backTo?: string
  backLabel?: string
}

export function NotFoundState({
  message,
  backTo = '/',
  backLabel = 'Back to Dashboard',
}: NotFoundStateProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-su-grey-dark">{message}</p>
      <Button variant="outline" onClick={() => navigate({ to: backTo })}>
        {backLabel}
      </Button>
    </div>
  )
}
