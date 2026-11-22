/**
 * The cross-document view-transition opt-in is in the document's own `<head>`.
 *
 * The browser reads the opt-in when it inserts `<body>`. Left only in the
 * linked stylesheet, a page whose stylesheet was still on the wire then had
 * not opted in, and the transition the previous page started was aborted
 * (`InvalidStateError: … ViewTransition opt-in disabled`, logged as a page
 * error). Inline, the opt-in is there whenever the body is.
 */

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { beginIslandCollection, endIslandCollection } from '../../../runtime/Island'
import { BaseLayout } from '../BaseLayout'

describe('BaseLayout: the view-transition opt-in', () => {
  beginIslandCollection()
  let markup = ''
  try {
    markup = renderToStaticMarkup(
      <BaseLayout meta={{}} pathname="/">
        {null}
      </BaseLayout>
    )
  } finally {
    endIslandCollection()
  }
  const head = markup.slice(0, markup.indexOf('</head>'))

  test('is inline in the head, so it is known when the body is inserted', () => {
    expect(head).toContain('@view-transition{navigation:auto}')
  })

  test('stays inside the reduced-motion guard the stylesheet uses', () => {
    expect(head).toContain(
      '<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>'
    )
  })
})
