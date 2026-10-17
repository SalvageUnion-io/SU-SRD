/** An entity's ART: its artwork, or none. Nothing stands in for missing art. */
import type { RefMetaEntity } from '../../schemas/index';
import type { EntityArt } from '../types';
/** The model's art: the image, or no art place at all. */
export declare function entityArt(entity: RefMetaEntity): EntityArt;
