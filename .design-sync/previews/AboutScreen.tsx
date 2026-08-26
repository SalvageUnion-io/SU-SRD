/*
 * Ported from packages/component-lib/src/components/shared/AboutScreen.stories.tsx.
 * Same `?raw` → plain-import + `.md` text-loader change as Colophon.tsx.
 */
import { AboutScreen } from 'component-lib'
import aboutMd from '../../ABOUT_JRVS.md'
import statementMd from '../../LLM_STATEMENT.md'
import thanksMd from '../../SPECIAL_THANKS.md'

/**
 * The app's About page. `version`, `aboutJrvs`, `llmStatement` and
 * `specialThanks` are props rather than imports, so the screen stays
 * app-agnostic — each app passes its own version and inlines the repo-root
 * documents the way its build allows.
 */
export function AboutPage() {
  return (
    <AboutScreen
      version="1.4.2"
      aboutJrvs={aboutMd}
      llmStatement={statementMd}
      specialThanks={thanksMd}
    />
  )
}
