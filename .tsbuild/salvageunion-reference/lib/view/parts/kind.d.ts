/**
 * What KIND of thing an entity is: its domain, its type stamp, have vs do, an
 * ability's tier numeral and a class's kind.
 */
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index';
import type { BayKind, ClassKind, EntityDomain } from '../types';
/** The domain a schema belongs to; `undefined` outside the enum (`actions` too). */
export declare function schemaDomain(schemaName: string): EntityDomain | undefined;
/**
 * HAVE vs DO (ruleset §5). Things you DO — an ability, an action — are the
 * book's ink banner; everything you HAVE wears its own tone. A data-shape
 * check: an ability carries `tree` + `level`, an action its `actionSource`.
 */
export declare function isDoEntity(entity: RefMetaEntity): boolean;
/** An ability's tier numeral: its numeric level in the tree (not G or L). */
export declare function tierNumeral(entity: RefMetaEntity): string | undefined;
/** The bare type: "Action", "Crawler Type", else the schema's display name. */
export declare function entityTypeLabel(schemaName: RefEnumSchemaName | 'actions'): string;
/** The seam's type stamp: the type, and for an ability its tree too
 * ("Ability · Forging Tree"). */
export declare function entityStamp(schemaName: RefEnumSchemaName | 'actions', entity: RefMetaEntity): string;
/** A pilot CLASS, by data shape: `coreTrees` and `hybrid` are class-only keys. */
export declare function isClassEntity(entity: RefMetaEntity): boolean;
/**
 * Which kind of class. ORDER and `=== false` are load-bearing: `advanceable`
 * is undefined on every hybrid, so a falsiness test would stamp all five
 * hybrids NON-ADVANCEABLE.
 */
export declare function classKind(entity: RefMetaEntity): ClassKind | undefined;
/**
 * Which kind of crawler bay, read off the stored `expansion` tag every bay
 * carries: Standard (on every Union Crawler, Core Book p.221) or Expansion
 * (built or found in play). `undefined` for anything without the tag.
 */
export declare function bayKind(entity: RefMetaEntity): BayKind | undefined;
/** The trees a HYBRID class advances from, read by the class's own name. */
export declare function classRequirements(entity: RefMetaEntity): string[];
export declare function isHybridTree(tree: string): boolean;
