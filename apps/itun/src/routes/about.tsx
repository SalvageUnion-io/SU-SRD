import { createFileRoute } from '@tanstack/react-router'
import { AboutScreen } from 'component-lib'
import aboutJrvsMd from '../../../../ABOUT_JRVS.md?raw'
import llmStatementMd from '../../../../LLM_STATEMENT.md?raw'
import specialThanksMd from '../../../../SPECIAL_THANKS.md?raw'
import { version } from '../../package.json'
import { pageTitle } from '../lib/pageTitle'

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: pageTitle('About') }] }),
  component: AboutPage,
})

function AboutPage() {
  return (
    <AboutScreen
      version={version}
      aboutJrvs={aboutJrvsMd}
      llmStatement={llmStatementMd}
      specialThanks={specialThanksMd}
    />
  )
}
