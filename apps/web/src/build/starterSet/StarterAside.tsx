/**
 * StarterAside — the Starter Set page's side track: how a premade crew gets to
 * the table, step by step, each step linked to where it happens, and the book
 * the crew comes from. Two info boxes (`TitledBox`), as a Reference Page's
 * side track holds; never taller than the crews beside them
 * (`styles/build/screens.css`).
 */

import { assetUrl } from 'salvageunion-reference'
import { assetDerivativeUrl } from 'salvageunion-reference/assetDerivatives'
import { TitledBox } from '../../components/index'
import { SIGN_IN_HREF } from '../../lib/accountBar'
import { appPath } from '../../lib/appBase'
import { STARTER_SET_ADVENTURE } from '../../lib/starterSet/starterTemplates'
import { buildStarterSetCopy } from '../../messages/build-starter-set'

/** The adventure's cover, in the art bucket as every source's is. */
const COVER = assetUrl('sources/reclamation-of-the-wastes.webp')
const BOOK_PAGE = '/sources/reclamation-of-the-wastes/'

export function StarterAside({ signedIn }: { signedIn: boolean }) {
  const steps = [
    { key: 'read', text: buildStarterSetCopy('stepRead') },
    ...(signedIn
      ? []
      : [
          {
            key: 'sign-in',
            text: buildStarterSetCopy('stepSignIn'),
            link: { href: SIGN_IN_HREF, label: buildStarterSetCopy('signIn') },
          },
        ]),
    { key: 'copy', text: buildStarterSetCopy('stepCopy') },
    {
      key: 'game',
      text: buildStarterSetCopy('stepGame'),
      link: { href: appPath('/games/'), label: buildStarterSetCopy('yourGames') },
    },
    { key: 'play', text: buildStarterSetCopy('stepPlay') },
  ]
  return (
    <aside className="su-starter-aside" aria-label={buildStarterSetCopy('fromCrewToTable')}>
      <TitledBox title={buildStarterSetCopy('fromCrewToTable')} titleAs="h2" tone="pilot">
        <ol className="su-starter-aside__steps">
          {steps.map((step) => (
            <li key={step.key}>
              {step.text}
              {step.link && (
                <>
                  {' '}
                  <a className="su-starter-aside__link" href={step.link.href}>
                    {step.link.label}
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </TitledBox>
      <TitledBox title={buildStarterSetCopy('theBook')} titleAs="h2" tone="pilot">
        <div className="su-starter-aside__book">
          <img
            className="su-starter-aside__cover"
            src={assetDerivativeUrl(COVER, 440)}
            alt=""
            width={440}
            height={624}
            loading="lazy"
            decoding="async"
          />
          <p>
            {buildStarterSetCopy('theBookBody', { adventure: STARTER_SET_ADVENTURE })}{' '}
            <a className="su-starter-aside__link" href={BOOK_PAGE}>
              {buildStarterSetCopy('readAboutTheBook')}
            </a>
          </p>
        </div>
      </TitledBox>
    </aside>
  )
}
