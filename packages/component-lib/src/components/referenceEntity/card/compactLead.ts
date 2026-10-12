/**
 * The compact card's LEAD (`leadProse`) is the entity model's lead
 * (`entityLead` in `salvageunion-reference`): an ability's description, else
 * its first paragraph, as plain text.
 */
export { entityLead as compactLead } from 'salvageunion-reference'

/** Whether the compact card has a body: value cells, a "//" line or a lead. */
export function hasCompactBody(statCount: number, hasSubLine: boolean, lead: string | undefined) {
  return statCount > 0 || hasSubLine || !!lead
}
