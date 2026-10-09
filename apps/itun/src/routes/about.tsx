import { createFileRoute } from '@tanstack/react-router'
import aboutJrvsMd from '../../../../ABOUT_JRVS.md?raw'
import llmStatementMd from '../../../../LLM_STATEMENT.md?raw'
import specialThanksMd from '../../../../SPECIAL_THANKS.md?raw'
import { AboutScreen } from '../components/shared/AboutScreen'
import { pageTitle } from '../lib/pageTitle'

// The deployed commit is the release (ADR-041); a local build has none.
const build = import.meta.env.VITE_COMMIT_REF?.slice(0, 7) ?? 'local'

export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: pageTitle('About') }] }),
  component: AboutPage,
})

function AboutPage() {
  return (
    <AboutScreen
      build={build}
      aboutJrvs={aboutJrvsMd}
      llmStatement={llmStatementMd}
      specialThanks={specialThanksMd}
    />
  )
}
