<!--
  The canonical LLM statement for this project.

  Both about pages render this file verbatim — srd's `/about`
  (`apps/srd/src/pages/about.astro`, read at build time with node:fs) and ITUN's
  `/about` (`apps/itun/src/routes/about.tsx`, inlined via a Vite `?raw` import).
  Edit the wording here and both sites change together; there is no second copy.

  Format contract (see `packages/component-lib/src/llmStatement/`): one `#`
  heading, then blank-line-separated plain paragraphs. The renderer does NOT
  interpret inline markdown — no links, bold, or lists.
-->

# How this was built

This was started as a hand-made project, and it predates the LLMs now used to work on it. The site and its schema are still shaped by hand.

Much of the code since then has been written with LLM assistance. Every change is directed, read, run, and merged by a person, and the commit history shows which parts.

We support open-weight models. We are against consolidated ownership of LLM infrastructure, and against the obtrusive, environmentally unsound data centers built to serve it.
