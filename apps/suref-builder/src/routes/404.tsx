import { createFileRoute } from '@tanstack/react-router'
import { NotFoundDisplay } from '../components/shared/NotFoundDisplay'

export const Route = createFileRoute('/404')({
  component: NotFoundPage,
  head: () => ({
    meta: [
      {
        title: '404 - Page Not Found - Salvage Union System Reference Document',
      },
      {
        name: 'description',
        content: 'The page you are looking for could not be found.',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  staticData: {
    ssr: true,
    prerender: true,
  },
})

function NotFoundPage() {
  return <NotFoundDisplay />
}
