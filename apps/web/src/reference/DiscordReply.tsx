import type { CSSProperties, ReactNode } from 'react'
import type { SampleBlock, SampleButton, SampleReply } from '../generated/discordSamples'
import { MARK_SRC } from '../lib/documentHead'

/**
 * DiscordReply — a screenshot of the bot's reply, drawn: the command as
 * typed, then the reply
 * the bot's own builders return (`DISCORD_SAMPLES`, generated from
 * `apps/discord-bot/src/sampleReplies.ts`), in Discord's dark theme, so the
 * picture cannot drift from what the bot sends. Its colours are Discord's,
 * not ours (`discord-reply.css`). Decorative: the controls are pictures of
 * controls, so the whole figure reads as one image.
 */

/** Discord's markdown, the part the bot writes: links, bold, italic. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let at = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > at) out.push(text.slice(at, index))
    const key = `${index}`
    if (match[1] !== undefined && match[2] !== undefined) {
      out.push(
        <span key={key} className="su-discord__link">
          {match[1]}
        </span>
      )
    } else if (match[3] !== undefined) out.push(<strong key={key}>{match[3]}</strong>)
    else if (match[4] !== undefined) out.push(<em key={key}>{match[4]}</em>)
    at = index + match[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

/** One text block's lines: a heading, small print, or a line of prose. */
function Text({ content }: { content: string }) {
  return (
    <div className="su-discord__text">
      {content.split('\n').map((line, i) => {
        const key = `${i}:${line}`
        if (line.startsWith('## ')) {
          return (
            <p key={key} className="su-discord__h2">
              {inline(line.slice(3))}
            </p>
          )
        }
        if (line.startsWith('-# ')) {
          return (
            <p key={key} className="su-discord__small">
              {inline(line.slice(3))}
            </p>
          )
        }
        return <p key={key}>{line === '' ? ' ' : inline(line)}</p>
      })}
    </div>
  )
}

function Button({ button }: { button: SampleButton }) {
  const primary = button.kind === 'action' && button.style === 1
  return (
    <span className="su-discord__button" data-primary={primary || undefined}>
      {button.label}
    </span>
  )
}

function Block({ block }: { block: SampleBlock }) {
  switch (block.kind) {
    case 'text':
      return <Text content={block.content} />
    case 'separator':
      return <hr className="su-discord__rule" />
    case 'section':
      return (
        <div className="su-discord__section">
          <div>
            {block.text.map((text) => (
              <Text key={text} content={text} />
            ))}
          </div>
          {block.thumbnail && (
            <img className="su-discord__thumb" src={block.thumbnail.url} alt="" loading="lazy" />
          )}
          {block.button && <Button button={block.button} />}
        </div>
      )
    case 'buttons':
      return (
        <div className="su-discord__buttons">
          {block.buttons.map((button) => (
            <Button key={button.label} button={button} />
          ))}
        </div>
      )
    case 'select':
      return <div className="su-discord__select">{block.placeholder}</div>
  }
}

export function DiscordReply({ sample, label }: { sample: SampleReply; label: string }) {
  return (
    <figure className="su-discord" aria-label={label} role="img">
      <div className="su-discord__typed">{sample.command}</div>
      <div className="su-discord__message">
        <img className="su-discord__avatar" src={MARK_SRC} alt="" />
        <div className="su-discord__body">
          <p className="su-discord__author">
            SalvageUnion.io <span className="su-discord__app">APP</span>
          </p>
          <div
            className="su-discord__container"
            style={
              {
                '--su-discord-accent': `#${sample.data.accent.toString(16).padStart(6, '0')}`,
              } as CSSProperties
            }
          >
            {sample.data.blocks.map((block, i) => (
              <Block key={`${block.kind}${i}`} block={block} />
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
