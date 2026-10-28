/**
 * frontDoor — the app's front door, rendered into its shell by the build
 * (`astro/pages/build/index.astro`), so a visitor's first paint is the page,
 * not a wait for the app to boot and its data to load.
 *
 * It is the app's own `FrontDoor`, drawn with only the schemas the app holds it
 * for (`FRONT_DOOR_SCHEMAS`), inside the same `#main-content` block the root
 * draws it in. Hidden unless the shell's head script marks the document as
 * opening on the front door (`FRONT_DOOR_ATTRIBUTE`); the app's first render
 * replaces it with the live one (`main.tsx`).
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { SalvageUnionReference } from 'salvageunion-reference'
import { FrontDoor } from '../../src/build/roster/FrontDoor'
import {
  FRONT_DOOR_ATTRIBUTE,
  FRONT_DOOR_SCHEMAS,
  FRONT_DOOR_STATIC_CLASS,
} from '../../src/build/roster/frontDoor.model'
import type { EntityLinkComponent } from '../../src/components/entity/entitySurfaceContext'
import type { EntitySurfaceValue } from '../../src/components/index'
import { EntitySurfaceProvider } from '../../src/components/index'
import { ACCOUNT_HINT_KEY, STORED_SESSION_KEY } from '../../src/lib/accountHint'
import { APP_BASE, appPath } from '../../src/lib/appBase'

/** The app's links, which its router puts under the base (`AppLink`), as plain anchors. */
const StaticAppLink: EntityLinkComponent = ({ href, children, ...rest }) => (
  <a href={appPath(href)} {...rest}>
    {children}
  </a>
)

const SURFACE: Partial<EntitySurfaceValue> = { linkAs: StaticAppLink, appliesRules: true }

/** The front door's markup, for the shell's `#root`. */
export async function frontDoorMarkup(): Promise<string> {
  await SalvageUnionReference.preload(FRONT_DOOR_SCHEMAS)
  return renderToStaticMarkup(
    <div className={FRONT_DOOR_STATIC_CLASS}>
      <div id="main-content" tabIndex={-1}>
        <EntitySurfaceProvider value={SURFACE}>
          <FrontDoor />
        </EntitySurfaceProvider>
      </div>
    </div>
  )
}

/**
 * `expectsFrontDoor`, as the shell's inline head script, which runs before the
 * body is drawn and so cannot wait for a module: the base's address and no
 * remembered account. No storage at all reads as no account, as
 * `browserStorage` does. `__tests__/frontDoorScript.test.ts` holds the two equal.
 */
export const FRONT_DOOR_SCRIPT = `(function(){var p=location.pathname;if(p!==${JSON.stringify(APP_BASE)}&&p!==${JSON.stringify(`${APP_BASE}/`)})return;var s=null;try{s=localStorage}catch(e){}try{if(s&&s.getItem(${JSON.stringify(ACCOUNT_HINT_KEY)})!==null&&s.getItem(${JSON.stringify(STORED_SESSION_KEY)}))return}catch(e){}document.documentElement.setAttribute(${JSON.stringify(FRONT_DOOR_ATTRIBUTE)},'')})()`
