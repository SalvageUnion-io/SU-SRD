import { ContextMenuCommandBuilder } from '@discordjs/builders'
import { ApplicationCommandType, MessageFlags } from 'discord-api-types/v10'
import {
  discordAccent,
  discordCardParts,
  rangeLabel,
  toEntityModel,
  truncate,
} from 'salvageunion-reference'
import type { ContainerBlock, ContainerData } from '../container.js'
import { toContainer } from '../container.js'
import { makeCustomId } from '../customId.js'
import { NEUTRAL_ACCENT } from '../format.js'
import { lookupKey } from '../lookupCard.js'
import type { FoundTerm } from '../termFinder.js'
import { findTerms } from '../termFinder.js'
import type { CommandExecuteInteraction } from './interactions.js'

/** The rules-blue band the glossary wears: an answer about words, not one entry. */
const GLOSSARY_ACCENT = discordAccent('wk-line')

/** How much of an entry's opening prose a row prints. */
const LEAD_MAX = 220

/**
 * One found term as a row: its name linking its page and its type, a line of
 * what it is, and a button that posts its full card to the channel. A term
 * matched by a roll-table row's label says which row.
 */
function termRow(term: FoundTerm): ContainerBlock {
  const model = toEntityModel(term.hit.entity)
  const parts = discordCardParts(model)
  const title = parts.head[1]?.replace(/^## /, '### ') ?? `### ${model.title}`
  const matched = term.row ? ` · matched “${term.matched}”, its ${rangeLabel(term.row)}` : ''
  const what = model.lead ?? parts.head.slice(2).join(' · ')
  const postId = makeCustomId('lookup', lookupKey(term.hit))
  return {
    kind: 'section',
    text: [
      `${title}\n-# ${model.kind.type}${matched}`,
      ...(what ? [truncate(what, LEAD_MAX)] : []),
    ],
    ...(postId
      ? { button: { kind: 'action' as const, customId: postId, label: 'Post to channel' } }
      : {}),
  }
}

/**
 * The answer: every term the message names, privately, each a row with the
 * way to share it. A message that names none says so, in the same system.
 */
export function lookUpMessageContainer(text: string, author?: string): ContainerData {
  const terms = findTerms(text)
  const whose = author ? `${author.toUpperCase()}'S MESSAGE` : 'THAT MESSAGE'
  if (terms.length === 0) {
    return {
      accent: NEUTRAL_ACCENT,
      blocks: [
        { kind: 'text', content: `-# NOTHING FOUND IN ${whose}` },
        {
          kind: 'text',
          content:
            'No Salvage Union term in it, as the book capitalises one. Try `/su lookup` with the name.',
        },
      ],
    }
  }
  const blocks: ContainerBlock[] = [
    { kind: 'text', content: `-# FOUND IN ${whose} (${terms.length})` },
  ]
  for (const [index, term] of terms.entries()) {
    if (index > 0) blocks.push({ kind: 'separator' })
    blocks.push(termRow(term))
  }
  return { accent: GLOSSARY_ACCENT, blocks }
}

/**
 * "Look up in Salvage Union": right-click any message › Apps. Finds the game
 * terms the message names and answers only the person who asked; a row's
 * "Post to channel" shares that entry's full card.
 */
export const lookUpMessageCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Look up in Salvage Union')
    .setType(ApplicationCommandType.Message),

  async execute(interaction: CommandExecuteInteraction): Promise<void> {
    const target = interaction.targetMessage
    const data = lookUpMessageContainer(target?.content ?? '', target?.author)
    await interaction.reply({
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      components: [toContainer(data)],
    })
  },
}
