/**
 * signedOutViews — the app's signed-out views (`SIGNED_OUT_VIEWS`: the front
 * door, the `/…/new` routes' sign-in panel), rendered into its shell by the
 * build (`astro/pages/build/index.astro`), so a first visit paints the page,
 * not a wait for the app to boot and its data to load.
 *
 * Each is the app's own screen, drawn with only the schemas the app holds it
 * for, inside the same `#main-content` block the root draws it in. All are
 * hidden but the one the shell's head script marks the document as opening on
 * (`SIGNED_OUT_VIEW_ATTRIBUTE`, `styles/build/screens.css`); the app's first
 * render replaces it with the live one (`main.tsx`).
 */

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SignedOutViewRoute } from '../../src/build/account/signedOutView.model'
import {
  SIGNED_OUT_STATIC_CLASS,
  SIGNED_OUT_VIEW_ATTRIBUTE,
  SIGNED_OUT_VIEWS,
} from '../../src/build/account/signedOutView.model'
import { FrontDoor } from '../../src/build/roster/FrontDoor'
import { SignInGate } from '../../src/build/wizard/NewEntityScreen'
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

/** Each signed-out view's screen, as its route draws it. */
const VIEWS: Record<SignedOutViewRoute, ReactNode> = {
  '/': <FrontDoor />,
  '/pilots/new': <SignInGate kind="pilot" />,
  '/mechs/new': <SignInGate kind="mech" />,
  '/crawlers/new': <SignInGate kind="crawler" />,
  '/npcs/new': <SignInGate kind="npc" />,
}

/** The signed-out views' markup, for the shell's `#root`. */
export async function signedOutViewsMarkup(): Promise<string> {
  await SalvageUnionReference.preload([...new Set(Object.values(SIGNED_OUT_VIEWS).flat())])
  return renderToStaticMarkup(
    <div id="main-content" tabIndex={-1}>
      <EntitySurfaceProvider value={SURFACE}>
        {Object.entries(VIEWS).map(([route, view]) => (
          <div key={route} className={SIGNED_OUT_STATIC_CLASS} data-view={route}>
            {view}
          </div>
        ))}
      </EntitySurfaceProvider>
    </div>
  )
}

/**
 * Set on `<html>` once the faces are in (or failed, or 3 s passed): until
 * then the marked view is laid out but not painted (`styles/build/screens.css`).
 * Painted in the fallback first, the sign-in panel's text is smaller than the
 * live one that replaces it, which a browser then counts as the page's
 * largest paint; its faces are preloaded with the stylesheets, so the wait is
 * short. The front door does not wait: its largest text is the tagline, whose
 * hand is not preloaded (`lib/scriptFont.ts`) and is narrower than its fallback.
 */
export const SIGNED_OUT_FONTS_ATTRIBUTE = 'data-signed-out-fonts'

/**
 * `value` as a JavaScript literal inside an inline `<script>`: JSON, with the
 * characters that could end the element or the line (`<`, `>`, U+2028,
 * U+2029) as escapes, which read back as themselves.
 */
const literal = (value: unknown): string =>
  JSON.stringify(value).replace(
    /[<>\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
  )

/**
 * `signedOutViewAt`, as the shell's inline head script, which runs before the
 * body is drawn and so cannot wait for a module: a view's route under the
 * base and no remembered account. No storage at all reads as no account, as
 * `browserStorage` does. `__tests__/signedOutViews.test.ts` holds the two equal.
 * It then waits for the faces (`SIGNED_OUT_FONTS_ATTRIBUTE`).
 */
export const SIGNED_OUT_VIEW_SCRIPT = `(function(){var p=location.pathname,b=${literal(APP_BASE)},r=p===b?"/":p.indexOf(b+"/")===0?p.slice(b.length):null;if(r===null||${literal(Object.keys(SIGNED_OUT_VIEWS))}.indexOf(r)<0)return;var s=null;try{s=localStorage}catch(e){}try{if(s&&s.getItem(${literal(ACCOUNT_HINT_KEY)})!==null&&s.getItem(${literal(STORED_SESSION_KEY)}))return}catch(e){}var d=document.documentElement,f=document.fonts,k=function(){d.setAttribute(${literal(SIGNED_OUT_FONTS_ATTRIBUTE)},"")},w=function(){if(f.status==="loaded")k()};d.setAttribute(${literal(SIGNED_OUT_VIEW_ATTRIBUTE)},r);if(!f||r==="/"){k();return}setTimeout(k,3000);f.addEventListener("loadingdone",w);f.addEventListener("loadingerror",w)})()`
