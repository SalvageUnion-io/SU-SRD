<!--
  The canonical LLM statement for this project.

  Rendered verbatim in the colophon on both about pages, alongside
  `ABOUT_JRVS.md` — srd's `/about` (`apps/srd/src/pages/about.astro`, read at
  build time with node:fs) and ITUN's `/about` (`apps/itun/src/routes/about.tsx`,
  inlined via a Vite `?raw` import). Edit the wording here and both sites change
  together; there is no second copy.

  Format contract (see `packages/component-lib/src/markdownSection/`): one `#`
  heading, then blank-line-separated paragraphs. `[label](href)` links are the
  only inline markdown the renderer interprets — bold, italics and lists would
  ship as literal punctuation.
-->

# LLM Statement

This was started as a hand-made project, and it predates the LLMs now used to work on it. The site and its schema are still shaped by hand.

Much of the code since then has been written with LLM assistance. Every change is directed, read, run, and merged by me, and the commit history shows which parts.

My job requires proficiency in these tools, and I best gain proficiency through passion projects like this. It has been my intention to use LLMs as a force multiplier, not as a replacement for my own judgment: to more consistently and efficiently implement my changes, not to decide on the changes themselves. Bugs or issues in this project are solely my responsibility and my fault.

I support open-weight models. I am against consolidated ownership of LLM infrastructure, and against the obtrusive, environmentally unsound data centers built to serve it.

Software is, and will always be, a human endeavor.
