import { ApplicationCommandType, EntryPointCommandHandlerType } from 'discord-api-types/v10'

/**
 * The app's Entry Point command (ADR-068): what Discord's Activity launcher
 * runs. Discord launches the Activity itself (`DiscordLaunchActivity`), so it
 * never reaches the Worker. `deploy-commands.ts` registers it beside `/su`,
 * since a bulk overwrite that leaves it out is refused once Activities are on.
 */
export const entryPointCommand = {
  name: 'launch',
  description: 'Open Play, the SalvageUnion.io Activity',
  type: ApplicationCommandType.PrimaryEntryPoint,
  handler: EntryPointCommandHandlerType.DiscordLaunchActivity,
} as const
