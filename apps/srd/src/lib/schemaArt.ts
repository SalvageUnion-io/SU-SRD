import { getAssetUrl, getModel } from 'salvageunion-reference'

/**
 * Whether any entity in a schema has artwork. Then every entity in it keeps an
 * art place — the listing's thumbnail column and the page's hero — and one
 * with none wears a censor mark there (`artSlot`, component-lib's
 * `MissingArt`). The schema must be loaded.
 */
export function schemaHasArt(schemaId: string): boolean {
  return (
    getModel(schemaId)
      ?.all()
      .some((item) => !!getAssetUrl(item)) ?? false
  )
}
