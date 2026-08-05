/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as bot from "../bot.js";
import type * as botClient from "../botClient.js";
import type * as botHttp from "../botHttp.js";
import type * as crew from "../crew.js";
import type * as downtime from "../downtime.js";
import type * as entities from "../entities.js";
import type * as games from "../games.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as mediator from "../mediator.js";
import type * as model_bot from "../model/bot.js";
import type * as model_entities from "../model/entities.js";
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
  account: typeof account;
  auth: typeof auth;
  bot: typeof bot;
  botClient: typeof botClient;
  botHttp: typeof botHttp;
  crew: typeof crew;
  downtime: typeof downtime;
  entities: typeof entities;
  games: typeof games;
  http: typeof http;
  invites: typeof invites;
  mediator: typeof mediator;
  "model/bot": typeof model_bot;
  "model/entities": typeof model_entities;
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
