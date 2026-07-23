import { createFileRoute } from '@tanstack/react-router'

import { AboutScreen } from 'component-lib'

import { version } from '../../package.json'
import llmStatementMd from '../../../../LLM_STATEMENT.md?raw'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <AboutScreen version={version} llmStatement={llmStatementMd} />
}
