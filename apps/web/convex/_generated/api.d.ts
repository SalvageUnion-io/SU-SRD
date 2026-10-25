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
import type * as authHealth from "../authHealth.js";
import type * as botClient from "../botClient.js";
import type * as botHttp from "../botHttp.js";
import type * as build from "../build.js";
import type * as buildFloor from "../buildFloor.js";
import type * as changeLog from "../changeLog.js";
import type * as channelBindings from "../channelBindings.js";
import type * as crew from "../crew.js";
import type * as crons from "../crons.js";
import type * as downtime from "../downtime.js";
import type * as entities from "../entities.js";
import type * as feedback from "../feedback.js";
import type * as games from "../games.js";
import type * as homebrew from "../homebrew.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as ledger from "../ledger.js";
import type * as mediator from "../mediator.js";
import type * as metrics from "../metrics.js";
import type * as model_addresses from "../model/addresses.js";
import type * as model_admin from "../model/admin.js";
import type * as model_bot from "../model/bot.js";
import type * as model_botRelay from "../model/botRelay.js";
import type * as model_channelBindings from "../model/channelBindings.js";
import type * as model_crawlerWrites from "../model/crawlerWrites.js";
import type * as model_entities from "../model/entities.js";
import type * as model_entityName from "../model/entityName.js";
import type * as model_homebrew from "../model/homebrew.js";
import type * as model_homebrewTables from "../model/homebrewTables.js";
import type * as model_invites from "../model/invites.js";
import type * as model_linkWrites from "../model/linkWrites.js";
import type * as model_opProposals from "../model/opProposals.js";
import type * as model_opTables from "../model/opTables.js";
import type * as model_opWrites from "../model/opWrites.js";
import type * as model_ownableWrites from "../model/ownableWrites.js";
import type * as model_patternAccess from "../model/patternAccess.js";
import type * as model_patternEmbed from "../model/patternEmbed.js";
import type * as model_permissions from "../model/permissions.js";
import type * as model_photos from "../model/photos.js";
import type * as model_playTables from "../model/playTables.js";
import type * as model_prepTables from "../model/prepTables.js";
import type * as model_referenceData from "../model/referenceData.js";
import type * as model_safetyTables from "../model/safetyTables.js";
import type * as model_seats from "../model/seats.js";
import type * as model_signalTables from "../model/signalTables.js";
import type * as model_staleWrite from "../model/staleWrite.js";
import type * as model_usage from "../model/usage.js";
import type * as model_validators from "../model/validators.js";
import type * as ops from "../ops.js";
import type * as ownership from "../ownership.js";
import type * as photos from "../photos.js";
import type * as publicSheet from "../publicSheet.js";
import type * as safety from "../safety.js";
import type * as salvageAreas from "../salvageAreas.js";
import type * as scenes from "../scenes.js";
import type * as seats from "../seats.js";
import type * as shelf from "../shelf.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  authHealth: typeof authHealth;
  botClient: typeof botClient;
  botHttp: typeof botHttp;
  build: typeof build;
  buildFloor: typeof buildFloor;
  changeLog: typeof changeLog;
  channelBindings: typeof channelBindings;
  crew: typeof crew;
  crons: typeof crons;
  downtime: typeof downtime;
  entities: typeof entities;
  feedback: typeof feedback;
  games: typeof games;
  homebrew: typeof homebrew;
  http: typeof http;
  invites: typeof invites;
  ledger: typeof ledger;
  mediator: typeof mediator;
  metrics: typeof metrics;
  "model/addresses": typeof model_addresses;
  "model/admin": typeof model_admin;
  "model/bot": typeof model_bot;
  "model/botRelay": typeof model_botRelay;
  "model/channelBindings": typeof model_channelBindings;
  "model/crawlerWrites": typeof model_crawlerWrites;
  "model/entities": typeof model_entities;
  "model/entityName": typeof model_entityName;
  "model/homebrew": typeof model_homebrew;
  "model/homebrewTables": typeof model_homebrewTables;
  "model/invites": typeof model_invites;
  "model/linkWrites": typeof model_linkWrites;
  "model/opProposals": typeof model_opProposals;
  "model/opTables": typeof model_opTables;
  "model/opWrites": typeof model_opWrites;
  "model/ownableWrites": typeof model_ownableWrites;
  "model/patternAccess": typeof model_patternAccess;
  "model/patternEmbed": typeof model_patternEmbed;
  "model/permissions": typeof model_permissions;
  "model/photos": typeof model_photos;
  "model/playTables": typeof model_playTables;
  "model/prepTables": typeof model_prepTables;
  "model/referenceData": typeof model_referenceData;
  "model/safetyTables": typeof model_safetyTables;
  "model/seats": typeof model_seats;
  "model/signalTables": typeof model_signalTables;
  "model/staleWrite": typeof model_staleWrite;
  "model/usage": typeof model_usage;
  "model/validators": typeof model_validators;
  ops: typeof ops;
  ownership: typeof ownership;
  photos: typeof photos;
  publicSheet: typeof publicSheet;
  safety: typeof safety;
  salvageAreas: typeof salvageAreas;
  scenes: typeof scenes;
  seats: typeof seats;
  shelf: typeof shelf;
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
