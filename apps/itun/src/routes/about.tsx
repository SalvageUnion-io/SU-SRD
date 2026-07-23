import { createFileRoute } from '@tanstack/react-router'

import { AboutScreen } from 'component-lib'

import { version } from '../../package.json'
import aboutJrvsMd from '../../../../ABOUT_JRVS.md?raw'
import llmStatementMd from '../../../../LLM_STATEMENT.md?raw'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <AboutScreen version={version} aboutJrvs={aboutJrvsMd} llmStatement={llmStatementMd} />
}
