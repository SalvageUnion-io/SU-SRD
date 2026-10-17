import type { RefSystem } from '../schemas/index';
/**
 * True when `system` is a Weapons System — i.e. at least one of its resolved
 * actions deals damage. Requires the `systems` and `actions` reference data to
 * be preloaded (the ORM resolves action-name refs against the action map).
 */
export declare function isWeaponSystem(system: RefSystem): boolean;
