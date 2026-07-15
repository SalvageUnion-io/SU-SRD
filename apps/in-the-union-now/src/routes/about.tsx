import { createFileRoute } from '@tanstack/react-router'

import { AboutScreen } from '../components/about/AboutScreen'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <AboutScreen />
}
