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
import { FRONT_DOOR_SCHEMAS } from '../../src/build/roster/frontDoorData'
import type { EntityLinkComponent } from '../../src/components/entity/entitySurfaceContext'
import type { EntitySurfaceValue } from '../../src/components/index'
import { EntitySurfaceProvider } from '../../src/components/index'
import { appPath } from '../../src/lib/appBase'

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
    <div className="su-front-door-static">
      <div id="main-content" tabIndex={-1}>
        <EntitySurfaceProvider value={SURFACE}>
          <FrontDoor />
        </EntitySurfaceProvider>
      </div>
    </div>
  )
}
