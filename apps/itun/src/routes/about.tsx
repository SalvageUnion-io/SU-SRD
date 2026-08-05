import { createFileRoute } from '@tanstack/react-router'
import { AboutScreen } from 'component-lib'
import aboutJrvsMd from '../../../../ABOUT_JRVS.md?raw'
import llmStatementMd from '../../../../LLM_STATEMENT.md?raw'
import { version } from '../../package.json'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <AboutScreen version={version} aboutJrvs={aboutJrvsMd} llmStatement={llmStatementMd} />
}
