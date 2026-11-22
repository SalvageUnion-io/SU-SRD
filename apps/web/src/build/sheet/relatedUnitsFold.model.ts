import { createContext } from 'react'

/**
 * Set where an empty Related units folds to one line at the page's end (a
 * phone's Mech sheet, r6 E10): with no unit linked, its title and what is
 * missing ("No Pilot · No Crawler") stand shut until opened.
 */
export const FoldEmptyRelated = createContext(false)
