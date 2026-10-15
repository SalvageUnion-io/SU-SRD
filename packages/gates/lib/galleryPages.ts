/**
 * The pages the screenshot gallery shoots (`tools/gallery.ts`): the screens worth a
 * reviewer's look, grouped the way the gallery prints them. A page names its
 * site; `signedIn` pages are reached through a seeded test account
 * (`tools/gallery.ts` copies three Starter Set characters to its Shelves), and
 * their `path` may name a seeded entity by kind (`:pilot`, `:mech`,
 * `:crawler`, `:game`), resolved once the seed has run.
 */

type GallerySite = 'srd' | 'cantina'

export type GalleryPage = {
  site: GallerySite
  path: string
  name: string
  note: string
  chips?: readonly string[]
  /** Reached through the seeded test account, after the seed. */
  signedIn?: boolean
  /** A sheet opened in Edit (its Read | Edit switch). */
  edit?: boolean
}

export type GallerySection = {
  id: string
  title: string
  /** A CSS colour for the section's band. */
  tone: string
  intro: string
  pages: readonly GalleryPage[]
}

const srd = (path: string, name: string, note: string, chips: readonly string[] = []) =>
  ({ site: 'srd', path, name, note, chips }) satisfies GalleryPage

const cantina = (
  path: string,
  name: string,
  note: string,
  extra: Partial<Pick<GalleryPage, 'signedIn' | 'edit' | 'chips'>> = {}
) => ({ site: 'cantina', path, name, note, ...extra }) satisfies GalleryPage

export const GALLERY_SECTIONS: readonly GallerySection[] = [
  {
    id: 'home',
    title: 'Home',
    tone: 'var(--rules)',
    intro: 'The contents page.',
    pages: [srd('/', 'Contents', 'The chapters, "At the table" and the Discord panel.')],
  },
  {
    id: 'listings',
    title: 'Listings',
    tone: 'var(--pilot)',
    intro: 'Rows grouped as the book prints them, with art where there is any, and the lore lead.',
    pages: [
      srd('/chassis/', 'Chassis', 'Grouped by tech level; every chassis with art.', ['Art']),
      srd('/systems/', 'Systems', 'The largest listing; no art column.'),
      srd('/abilities/', 'Abilities', 'Grouped by tree; each Row in its tier tone.'),
      srd('/creatures/', 'Creatures', 'Art and art-less entities mixed.'),
      srd('/bio-titans/', 'Bio-Titans', 'An entity grid: every Row one height.'),
      srd('/keywords/', 'Keywords', 'Text only: a name and a lead.'),
      srd('/search?q=drill', 'Search: "drill"', 'Search results as Rows.'),
    ],
  },
  {
    id: 'entities',
    title: 'Entity pages',
    tone: 'var(--mech)',
    intro: 'Where the most structure stacks up: patterns, trees, loadouts, nested cards.',
    pages: [
      srd('/chassis/mazona/', 'Mazona', 'Patterns as cards; Tech Level in the band.', ['Patterns']),
      srd(
        '/chassis/mazona/pattern/buzzard/',
        '“Buzzard”',
        'A pattern page: its loadout as Rows under the stats.',
        ['Pattern']
      ),
      srd(
        '/bio-titans/typhon/pattern/hill-worm/',
        'Typhon “Hill Worm”',
        'A Bio-Titan pattern and the action it adds.'
      ),
      srd('/chassis/big-brother/', 'Big Brother', 'Chassis abilities and a drone card.'),
      srd('/creatures/irradiated-scorpion/', 'Irradiated Scorpion', 'An art-less page: no hero.', [
        'No art',
      ]),
      srd('/classes/hacker/', 'Hacker', 'The ability tree.'),
      srd('/bio-titans/tyrant/', 'Tyrant', 'Art hero and a long run of actions.'),
      srd('/npcs/saboteur/', 'Saboteur', 'Actions flowing around the art.'),
      srd('/drones/pest-drone/', 'Pest Drone', 'A systems tray beside the art.'),
      srd('/crawler-bays/armoury/', 'Armoury', 'A crawler bay with its NPC.'),
      srd('/systems/salvaging-drill/', 'Salvaging Drill', 'Trait Tags and action facets (E17).'),
    ],
  },
  {
    id: 'tables',
    title: 'Roll tables',
    tone: 'var(--denizen)',
    intro: 'Each page sets its density from its table; the Roll button never moves.',
    pages: [
      srd('/roll-tables/core-mechanic/', 'Core Mechanic', 'Roomy: one column of bands.'),
      srd('/roll-tables/mechapult/', 'Mechapult', 'Dense: two columns, numbers outside.'),
      srd(
        '/roll-tables/callsign-table/',
        'Callsign Table',
        'Two rolls: the column, then the entry.'
      ),
    ],
  },
  {
    id: 'guides',
    title: 'Guides',
    tone: 'var(--crawler)',
    intro: "Steps on the book's ink banner, sections under solid slabs.",
    pages: [
      srd('/guides/create-a-pilot/', 'Create a Pilot', 'Numbered steps with their option cards.'),
      srd('/guides/heat/', 'Heat', 'A rules page.'),
    ],
  },
  {
    id: 'cantina',
    title: 'The Cantina, signed out',
    tone: 'var(--rust)',
    intro:
      "The character builder as a visitor sees it: the front door and the Starter Set's ready-made characters, read-only.",
    pages: [
      cantina('/', 'Front door', 'Signed out: the Starter Set and sign-in.'),
      cantina('/starter', 'Starter Set', 'Six pilots, six mechs and a crawler.'),
      cantina('/starter/pilot/starter-pilot-bonesaw', 'Bonesaw', 'A read-only pilot sheet.'),
      cantina('/starter/mech/starter-mech-mazona', 'Mazona', 'A read-only mech sheet.'),
    ],
  },
  {
    id: 'cantina-edit',
    title: 'The Cantina, signed in',
    tone: 'var(--pilot)',
    intro:
      'A fresh test account with Bonesaw, the Mazona and Tenacity copied from the Starter Set, Bonesaw moved into a Game.',
    pages: [
      cantina('/', 'Shelves', 'The roster of what the account keeps.', { signedIn: true }),
      cantina(':pilot', 'Bonesaw, editing', 'A pilot sheet in Edit.', {
        signedIn: true,
        edit: true,
      }),
      cantina(':mech', 'Mazona, editing', 'A mech sheet in Edit.', { signedIn: true, edit: true }),
      cantina(':crawler', 'Tenacity, editing', 'A crawler sheet in Edit.', {
        signedIn: true,
        edit: true,
      }),
      cantina('/pilots/new', 'New pilot', 'The pilot builder.', { signedIn: true }),
      cantina('/mechs/new', 'New mech', 'The mech builder.', { signedIn: true }),
      cantina(':game', 'A Game', "A Game's page with Bonesaw moved in.", { signedIn: true }),
    ],
  },
]

/** A page's file stem: its site (and whether signed in), then its path, lowercase and dashed. */
export function pageSlug(page: Pick<GalleryPage, 'site' | 'path' | 'signedIn'>): string {
  const path = page.path
    .replace(/^\/|\/$/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
  return `${page.site}${page.signedIn ? '-in' : ''}-${path.toLowerCase() || 'home'}`
}
