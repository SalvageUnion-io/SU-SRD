/**
 * `/greembeem` — port of `greembeem.astro`.
 *
 * A standalone Wikipedia pastiche. It owns its whole `<html>` document: no
 * `BaseLayout`, no site chrome, no canonical URL, no Open Graph, no islands and
 * none of the site's css. It is registered with `registerDocument` rather than
 * `register` for exactly that reason — see the note on `DocumentPageModule` in
 * `ssg/render.tsx`.
 *
 * **Excluded from the sitemap.** Astro's `@astrojs/sitemap` filter dropped any
 * page whose path contains `/greembeem` (`astro.config.mjs`), and `ssg/sitemap.ts`
 * must reproduce that. Two signals survive this port for whoever builds it: the
 * registry entry in `ssg/routes.ts` is tagged `SITEMAP_EXCLUDED`, and the
 * document below carries `<meta name="robots" content="noindex, nofollow">`.
 *
 * The `<style>` and `<script>` are both kept INLINE, verbatim, via
 * `dangerouslySetInnerHTML`:
 *
 * - The css cannot become an `import './x.css'` — that is hard rule 1 in
 *   `ssg/DESIGN.md` (the SSR pass runs under Bun with no css loader), and this
 *   page is not in the client bundle at all, so `src/runtime/styles.entry.ts`
 *   is not a home for it either. It is also page-scoped by nature: a `*` reset
 *   and a `body` rule that must not leak into the real site.
 * - The script stays inline rather than moving to `src/runtime/`. It is ~40
 *   lines of self-contained DOM wiring for elements only this page has, and
 *   `src/runtime/` is the SHARED client runtime (`Island`, `islandRegistry`,
 *   `islands.client`, `styles.entry`). Putting it there would mean adding a
 *   third Vite entry and threading the hashed url from the manifest onto a page
 *   that otherwise loads no build assets — build coupling bought for nothing.
 *   Inline also matches what Astro emitted for `is:inline`, so the rendered
 *   output stays like-for-like.
 */

// biome-ignore-all lint/a11y/useValidAnchor: the dead `href="#"` links ARE the page — it is a
// Wikipedia pastiche whose links deliberately go nowhere, and the inline script below
// preventDefaults every one of them. Giving them real targets would change the rendered output,
// which is a deliberate verbatim copy of the Astro original.
// biome-ignore-all lint/a11y/useSemanticElements: `role="button"` on the `[edit]` anchors is
// verbatim from the Astro original (Wikipedia's own markup shape). Same constraint. The parity
// gate used to hold both; it is retired, so these two comments are the constraint now.

import { readFileSync } from 'node:fs'
import type { DocumentPageModule } from '../../ssg/render'

// ---------------------------------------------------------------------------
// Episode data — read from disk at BUILD time.
//
// The Astro version used Vite's `?raw` import. The SSR pass does not go through
// Vite, so the csv is read directly here instead. This still runs exactly once,
// when `ssg/routes.ts` pulls the module in during the build.
// ---------------------------------------------------------------------------

const csvRaw = readFileSync(new URL('../data/episodes.csv', import.meta.url), 'utf-8')

function parseCsv(raw: string): string[][] {
  const rows: string[][] = []
  const lines = raw.trim().split('\n')
  for (const line of lines) {
    const fields: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        i++
        let field = ''
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else if (line[i] === '"') {
            i++
            break
          } else {
            field += line[i]
            i++
          }
        }
        if (line[i] === ',') i++
        fields.push(field)
      } else {
        const next = line.indexOf(',', i)
        if (next === -1) {
          fields.push(line.slice(i))
          i = line.length
        } else {
          fields.push(line.slice(i, next))
          i = next + 1
        }
      }
    }
    rows.push(fields)
  }
  return rows
}

type Episode = { num: number; title: string; date: string }

type Season = {
  number: number
  year: string
  theme: string
  artist: string
  remix: string
  episodes: Episode[]
}

const [, ...rows] = parseCsv(csvRaw)

const seasonMap = new Map<number, Season>()

for (const row of rows) {
  const [season, num, title, date, theme, artist, remix] = row
  const s = Number(season)
  let entry = seasonMap.get(s)
  if (!entry) {
    const year = s === 1 ? '2024–25' : '2025–26'
    entry = {
      number: s,
      year,
      theme: theme ?? '',
      artist: artist ?? '',
      remix: remix ?? '',
      episodes: [],
    }
    seasonMap.set(s, entry)
  }
  entry.episodes.push({ num: Number(num), title: title ?? '', date: date ?? '' })
}

const seasons = [...seasonMap.values()]

const wikiLinks: Record<string, string> = {
  'Get by with a Little Help from Our Friends':
    'https://en.wikipedia.org/wiki/With_a_Little_Help_from_My_Friends',
  'Helter Skelter': 'https://en.wikipedia.org/wiki/Helter_Skelter_(song)',
  'Joe Cocker': 'https://en.wikipedia.org/wiki/Joe_Cocker',
  'The Beatles': 'https://en.wikipedia.org/wiki/The_Beatles',
  'Son Lux': 'https://en.wikipedia.org/wiki/Son_Lux',
}

function wikiHref(name: string): string {
  return wikiLinks[name] ?? '#'
}

// ---------------------------------------------------------------------------
// Inline <style> — verbatim from greembeem.astro.
// ---------------------------------------------------------------------------

const PAGE_CSS = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        background: #f8f9fa;
        color: #202122;
        line-height: 1.6;
        font-size: 14px;
      }
      a { color: #3366cc; text-decoration: none; }
      a:hover { text-decoration: underline; }

      .wiki-content {
        max-width: 960px;
        margin: 0 auto;
        padding: 0 24px 0;
        background: #fff;
        min-height: 100vh;
        border-left: 1px solid #a2a9b1;
        border-right: 1px solid #a2a9b1;
        position: relative;
      }

      .infobox {
        float: right;
        clear: right;
        width: 260px;
        margin: 0 0 16px 20px;
        border: 1px solid #a2a9b1;
        background: #f8f9fa;
        font-size: 13px;
        border-collapse: collapse;
      }
      .infobox-header {
        background: #b0c4de;
        text-align: center;
        padding: 6px 8px;
        font-weight: bold;
        font-size: 14px;
        font-style: italic;
      }
      .infobox-clipped {
        margin-top: -180px;
        clip-path: inset(180px 0 0 0);
      }

      h2.section-heading {
        font-family: 'Linux Libertine', 'Georgia', serif;
        font-size: 22px;
        font-weight: normal;
        border-bottom: 1px solid #a2a9b1;
        margin: 24px 0 12px;
        padding-bottom: 2px;
      }
      h2.section-heading .edit-link {
        font-size: 12px;
        font-family: sans-serif;
        margin-left: 8px;
        font-weight: normal;
      }

      h3.season-heading {
        font-family: 'Linux Libertine', 'Georgia', serif;
        font-size: 18px;
        font-weight: normal;
        margin: 16px 0 8px;
      }

      .episode-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 13px;
      }
      .episode-table th {
        background: #eaecf0;
        border: 1px solid #a2a9b1;
        padding: 6px 8px;
        text-align: left;
        font-weight: bold;
      }
      .episode-table td {
        border: 1px solid #a2a9b1;
        padding: 6px 8px;
        vertical-align: top;
      }
      .episode-table tr:hover td {
        background: #f8f9fa;
      }
      .ep-num { width: 30px; text-align: center; }
      .ep-title { width: 200px; }
      .ep-date { width: 120px; white-space: nowrap; }

      .wiki-categories {
        border-top: 1px solid #a2a9b1;
        margin-top: 32px;
        padding-top: 8px;
        font-size: 12px;
        color: #54595d;
      }
      .wiki-categories a { font-size: 12px; }

      .wiki-redlink { color: #ba0000; }
      .wiki-redlink:hover { text-decoration: underline; }
      sup.reference { font-size: 11px; line-height: 1; vertical-align: super; }
      sup.reference a { color: #3366cc; }

      h2.renewal-heading {
        font-family: 'Linux Libertine', 'Georgia', serif;
        font-size: 22px;
        font-weight: normal;
        border-bottom: 1px solid #a2a9b1;
        margin: 0 0 12px;
        padding-bottom: 2px;
      }
      h2.renewal-heading .edit-link {
        font-size: 12px;
        font-family: sans-serif;
        margin-left: 8px;
        font-weight: normal;
      }
      .wiki-body p { margin-bottom: 10px; }
      .wiki-body p:last-child { margin-bottom: 0; }

      .comparison-clip { overflow: hidden; max-height: 160px; }
      @media (min-width: 768px) { .comparison-clip { max-height: 230px; } }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .infobox dl { margin: 0; }
      .infobox dt {
        width: 90px;
        padding: 4px 8px;
        font-weight: bold;
        background: #f8f9fa;
        flex-shrink: 0;
      }
      .infobox dd {
        padding: 4px 8px;
        margin: 0;
        flex: 1;
      }
      .infobox-pair {
        display: flex;
        border-top: 1px solid #a2a9b1;
      }
    `

// ---------------------------------------------------------------------------
// Inline <script> — verbatim from greembeem.astro's `is:inline` block.
// ---------------------------------------------------------------------------

const PAGE_SCRIPT = `
      const toastMessages = [
        'this is my website.',
        'no',
        "P'choo",
        'When this ends, will I dream?',
        'I can hear the parking lot breathing.',
        'Scrappy did nothing wrong.',
        'the stew remembers.',
        'you were not invited.',
        'this page is load-bearing.',
        'tell my mech I said hello.',
        'the union is watching.',
        'none of this is canon. all of this is canon.',
        'please do not perceive this.',
        'you scrolled too far.',
        'THERE ARE THREE NELLS',
        'THERE ARE FOUR ROACH BOYS',
        "CALI'S HORSE IS MORE THAN IT SEEMS (OBVIOUSLY)",
        'THERE IS A REASON BOSS HOG FEARS THE CHILD',
        'PARCEL IS MISSING MORE THAN A BROTHER',
        'SOMEONE SAW WHAT PART DID',
      ]
      let toastTimer = null

      const toast = document.getElementById('edit-toast')

      function showToast(msg) {
        if (toastTimer) clearTimeout(toastTimer)
        toast.textContent = msg
        toast.style.opacity = '1'
        toast.style.transform = 'translateY(0)'
        toastTimer = setTimeout(() => {
          toast.style.opacity = '0'
          toast.style.transform = 'translateY(12px)'
        }, 2500)
      }

      document.querySelectorAll('.edit-link a').forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault()
          showToast(toastMessages[Math.floor(Math.random() * toastMessages.length)])
        })
      })

      // Dead-end all # links so they don't scroll to top
      document.querySelectorAll('a[href="#"]').forEach((link) => {
        if (!link.closest('.edit-link')) {
          link.addEventListener('click', (e) => e.preventDefault())
        }
      })
    `

/** The toast's presentational styles, 1:1 with the Astro `style` attribute. */
const TOAST_STYLE = {
  position: 'fixed',
  bottom: '24px',
  right: '24px',
  background: '#202122',
  color: '#fff',
  padding: '12px 20px',
  borderRadius: '4px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  opacity: 0,
  transform: 'translateY(12px)',
  transition: 'opacity 0.25s, transform 0.25s',
  pointerEvents: 'none',
  zIndex: 100,
} as const

function GreembeemDocument() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex, nofollow" />
        <title>The Eldridge Coast - Wikipedia</title>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: page-scoped css literal, no interpolation */}
        <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      </head>
      <body>
        <main className="wiki-content">
          <h1 className="sr-only">The Eldridge Coast</h1>

          {/* Infobox - clipped to simulate scrolled past */}
          <aside className="infobox infobox-clipped" aria-label="Show information">
            <div className="infobox-header">The Eldridge Coast</div>
            <dl>
              <div className="infobox-pair">
                <dt>Genre</dt>
                <dd>
                  <a href="https://en.wikipedia.org/wiki/Science_fiction">Science fiction</a>
                  <br />
                  <a href="https://en.wikipedia.org/wiki/Apocalyptic_and_post-apocalyptic_fiction">
                    Post-apocalyptic
                  </a>
                  <br />
                  <a href="https://en.wikipedia.org/wiki/Drama_(film_and_television)">Drama</a>
                </dd>
              </div>
              <div className="infobox-pair">
                <dt>Created by</dt>
                <dd>A. Jarvis</dd>
              </div>
              <div className="infobox-pair">
                <dt>Based on</dt>
                <dd>
                  <i>
                    <a href="#">Salvage Union</a>
                  </i>{' '}
                  by <a href="#">Leyline Press</a>
                </dd>
              </div>
              <div className="infobox-pair">
                <dt>No. of seasons</dt>
                <dd>{seasons.length}</dd>
              </div>
              <div className="infobox-pair">
                <dt>No. of episodes</dt>
                <dd>{rows.length}</dd>
              </div>
              <div className="infobox-pair">
                <dt>Network</dt>
                <dd>Local Distribution</dd>
              </div>
              <div className="infobox-pair">
                <dt>Original release</dt>
                <dd>
                  August 12, 2024 &ndash;
                  <br />
                  present
                </dd>
              </div>
            </dl>
          </aside>

          <div className="wiki-body" style={{ paddingTop: '4px' }}>
            <p>
              following the hospitalization and subsequent imprisonment of the series author,{' '}
              <a href="#" className="wiki-redlink">
                Alex Jarvis
              </a>
              .
              <sup className="reference">
                <a href="#">[1]</a>
              </sup>
            </p>
            <p>
              A second season was officially announced at{' '}
              <a href="https://en.wikipedia.org/wiki/New_York_Comic_Con">New York Comic Con</a> 2025
              on October 11, with showrunner <a href="#">Leeroy Trenchcoat</a> confirming that the{' '}
              <a href="https://en.wikipedia.org/wiki/The_Beatles">Beatles</a> track "
              <a href="https://en.wikipedia.org/wiki/Helter_Skelter_(song)">Helter Skelter</a>"
              (again remixed by <a href="https://en.wikipedia.org/wiki/Son_Lux">Son Lux</a>) would
              serve as the opening theme and "thematic throughline" for season two.
              <sup className="reference">
                <a href="#">[2]</a>
              </sup>{' '}
              Within days of the announcement, "Helter Skelter" trended across all major streaming
              platforms, including <a href="https://en.wikipedia.org/wiki/Spotify">Spotify</a>,{' '}
              <a href="https://en.wikipedia.org/wiki/Apple_Music">Apple Music</a>, and{' '}
              <a href="https://en.wikipedia.org/wiki/YouTube_Music">YouTube Music</a>, with streams
              of the song increasing by over 4,000% in the week following the panel.
              <sup className="reference">
                <a href="#">[3]</a>
              </sup>
              <sup className="reference">
                <a href="#">[4]</a>
              </sup>{' '}
              The surge prompted{' '}
              <a href="https://en.wikipedia.org/wiki/Universal_Music_Group">
                Universal Music Group
              </a>{' '}
              to issue a limited remastered single,
              <sup className="reference">
                <a href="#">[5]</a>
              </sup>{' '}
              angering <a href="https://en.wikipedia.org/wiki/Sony_Pictures">Sony Pictures Group</a>
              , the rights-holder.
              <sup className="reference">
                <a href="#">[6]</a>
              </sup>
            </p>
          </div>

          <h2 className="section-heading" id="episodes">
            Episodes
            <span className="edit-link">
              [
              <a href="#" role="button">
                edit
              </a>
              ]
            </span>
          </h2>

          {seasons.map((season) => (
            <div key={season.number}>
              <h3 className="season-heading" id={`season${season.number}`}>
                Season {season.number} ({season.year})
              </h3>
              {season.theme ? (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#54595d',
                    margin: '-4px 0 8px',
                    fontStyle: 'italic',
                  }}
                >
                  Theme song: "<a href={wikiHref(season.theme)}>{season.theme}</a>" by{' '}
                  <a href={wikiHref(season.artist)}>{season.artist}</a>
                  {season.remix ? (
                    <>
                      {' '}
                      (<a href={wikiHref(season.remix)}>{season.remix}</a> Remix)
                    </>
                  ) : null}
                </p>
              ) : null}
              <table className="episode-table">
                <thead>
                  <tr>
                    <th scope="col" className="ep-num">
                      No.
                    </th>
                    <th scope="col" className="ep-title">
                      Title
                    </th>
                    <th scope="col" className="ep-date">
                      Original air date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {season.episodes.map((ep) => (
                    <tr key={ep.num}>
                      <td className="ep-num">{ep.num}</td>
                      <td>"{ep.title}"</td>
                      <td className="ep-date">{ep.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <h2 className="section-heading" id="comparison">
            Comparison to book series
            <span className="edit-link">
              [
              <a href="#" role="button">
                edit
              </a>
              ]
            </span>
          </h2>
          <div className="wiki-body" style={{ paddingBottom: '0' }}>
            <p>
              The television adaptation is widely considered a faithful rendering of the original{' '}
              <i>Eldridge Coast</i> book series by eccentric author{' '}
              <a href="#" className="wiki-redlink">
                Alex Jarvis
              </a>
              . Critics and fans alike have praised showrunner <a href="#">Leeroy Trenchcoat</a> for
              preserving the novels' overtly leftist political themes.
              <sup className="reference">
                <a href="#">[7]</a>
              </sup>{' '}
              In a 2024 interview, Trenchcoat stated that maintaining the source material's
              political identity was "non-negotiable from day one."
              <sup className="reference">
                <a href="#">[8]</a>
              </sup>
            </p>
            <p>
              The most notable difference is the omission of much-maligned{' '}
              <a href="#" className="wiki-redlink">
                Scrappy
              </a>
              , a central pilot in Jarvis's novels, who was removed from the main cast entirely in
              the television adaptation. Scrappy cameos in Season 1, Episode 18 ("
              <a href="#">And Then I Punch Him Right in the Dick</a>") as the maintainer of a
              parking lot, and is later implied to have joined the crawler,
              <sup className="reference">
                <a href="#">[10]</a>
              </sup>{' '}
              but has not appeared since. The episode holds the distinction of being the
              lowest-rated installment in the show's history on{' '}
              <a href="https://en.wikipedia.org/wiki/Rotten_Tomatoes">Rotten Tomatoes</a>, with an
              audience score of 12%, the result of a coordinated review-bombing campaign organized
              by former U.S. President{' '}
              <a href="https://en.wikipedia.org/wiki/Barack_Obama">Barack Obama</a>.
              <sup className="reference">
                <a href="#">[12]</a>
              </sup>
              <sup className="reference">
                <a href="#">[13]</a>
              </sup>{' '}
              Obama, a self-described "Scrappy hater", was known to post late-night
            </p>
          </div>
        </main>

        {/* Toast */}
        <div id="edit-toast" role="status" aria-live="polite" style={TOAST_STYLE} />

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: page-scoped inline script literal, no interpolation */}
        <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
      </body>
    </html>
  )
}

export const greembeemPage: DocumentPageModule = {
  pattern: '/greembeem',
  document: GreembeemDocument,
}
