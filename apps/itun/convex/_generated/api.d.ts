/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as __tests___harness from "../__tests__/harness.js";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as crew from "../crew.js";
import type * as entities from "../entities.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as mediator from "../mediator.js";
import type * as model_permissions from "../model/permissions.js";
import type * as ownership from "../ownership.js";
import type * as proposals from "../proposals.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "__tests__/harness": typeof __tests___harness;
  account: typeof account;
  auth: typeof auth;
  crew: typeof crew;
  entities: typeof entities;
  games: typeof games;
  http: typeof http;
  invites: typeof invites;
  mediator: typeof mediator;
  "model/permissions": typeof model_permissions;
  ownership: typeof ownership;
  proposals: typeof proposals;
  templates: typeof templates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
