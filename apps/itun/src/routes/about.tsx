import { createFileRoute } from '@tanstack/react-router'

import { AboutScreen } from 'component-lib'

import { version } from '../../package.json'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <AboutScreen version={version} />
}
