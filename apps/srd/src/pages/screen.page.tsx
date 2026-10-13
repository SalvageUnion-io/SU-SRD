/**
 * `/screen/` — the Mediator Screen: the tables the Quick Reference Sheet
 * gathers on its first page, on one dense page, each rolled where it sits.
 *
 * The panels flow in the Quick Ref's order (`screenPanels`) through balanced
 * columns: one on a phone, up to four on a wide screen. Each d20 table is a
 * `ScreenTableIsland` whose server markup is the table itself, so the page
 * reads in full before (or without) its script; Heat, the distances and the
 * Downtime procedure are static.
 */

import { ChapterBand } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { ScreenReferenceView, ScreenTableView } from '../components/ScreenView'
import { TITLE_SUFFIX } from '../lib/constants'
import { screenPanels } from '../lib/screenPage'
import '../lib/gameData'
import { Island } from '../runtime/Island'

const TITLE = `Mediator Screen${TITLE_SUFFIX}`
const DESCRIPTION =
  'The Salvage Union tables a Mediator reaches for at the table on one page: Core Mechanic, Critical Injury and Damage, Heat and Reactor Overload, Salvage, the NPC tables, distances and Downtime, every table rolled in place.'

/** The page's measure: wide, so a desktop sets the panels four across. */
const MEASURE = '96rem'

function page(): PageResult {
  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
    },
    children: (
      <div className="srd-screen">
        <ChapterBand measure={MEASURE}>Mediator Screen</ChapterBand>
        <div className="srd-screen__body" style={{ maxWidth: MEASURE }}>
          {screenPanels().map((panel) => (
            <div key={panel.id} className="srd-screen__cell">
              {panel.kind === 'table' ? (
                <Island name="ScreenTableIsland" client="idle" ssr props={{ panel }}>
                  <ScreenTableView panel={panel} roll={null} />
                </Island>
              ) : (
                <ScreenReferenceView panel={panel} />
              )}
            </div>
          ))}
        </div>
      </div>
    ),
  }
}

export const screenPage: PageModule = {
  pattern: '/screen',
  page,
}
