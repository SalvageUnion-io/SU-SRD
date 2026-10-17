/**
 * An entity's TONE, as the theme token key the UI paints (`--color-<key>`),
 * and which FILL its header takes. The colours themselves stay in
 * `theme.css`, since this package knows no CSS.
 */
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index';
/**
 * A guide's tone token, or `undefined` for every other entity: rules blue for
 * every guide, as its page's band is (owner's call, 2026-10-14), so the guides
 * index reads as one chapter. A guide is the record with a `guideType`.
 */
export declare function guideTone(entity: RefMetaEntity): string | undefined;
/**
 * The tone token. An ACTION is `ink`: it has no tone of its own. A guide and
 * every rules entry (keyword, trait, distance, source, roll table) wear rules
 * blue (`wk-line`); gear rides the tech-level ramp (`tl-1`…`tl-6`, `tl-b`,
 * `tl-n`) — systems and modules included, as the book heads each entry and
 * index row in its tech level's blue under the green Mech Workshop band
 * (Core Book pp. 162–164, 188–190); black-market goods are `ink-2`; abilities
 * take their tier tone; everything else its schema's hue.
 */
export declare function entityTone(schemaName: RefEnumSchemaName | 'actions', entity: RefMetaEntity): string;
/** The header's two fills (ruleset §5): TONE for things you have, INK for
 * things you do. */
export type HeaderFill = 'tone' | 'ink';
/**
 * Which fill a header takes in a form (E12): things you do are the ink banner,
 * except an ability's Row, which wears its tier tone (Core orange, Advanced
 * and Hybrid rust, Legendary pink) wherever abilities are listed.
 */
export declare function headerFill(entity: RefMetaEntity, form: 'row' | 'card' | 'page'): HeaderFill;
