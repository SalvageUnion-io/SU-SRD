/**
 * An entity's LEAD: its own opening prose as plain text.
 */
import type { RefMetaEntity, RefObjectContentBlock } from '../../schemas/index';
/** A content array's first paragraph, as text (references still marked up). */
export declare function firstParagraphText(content: RefObjectContentBlock[] | undefined): string | undefined;
/**
 * The lead: an ability's description, else the entity's first paragraph — the
 * lore a chassis, class or denizen opens with — else, for a guide with no
 * preamble of its own, its first step's, else the opening paragraph of what it
 * grants or does (a First Aid Kit's action). Every listing leads with prose
 * when the entity carries any. Plain text, since a clamped line renders no
 * references.
 */
export declare function entityLead(entity: RefMetaEntity): string | undefined;
