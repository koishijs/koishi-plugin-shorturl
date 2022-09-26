import { Context, RuntimeError, Schema, segment, Session } from 'koishi'

declare module 'koishi' {
  interface Tables {
    shorturl: Shorturl
  }
}

export interface Shorturl {
  id: string
  url: string
  count: number
}

export const KEY_LENGTH = 6

export const name = 'shorturl'

export interface Config {
  path: string
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().description('短链接路由。').default('/s'),
})

export function apply(ctx: Context, config: Config) {
  async function generate(url: string) {
    let id: string
    while (true) {
      id = Math.random().toString(36).slice(2, 2 + KEY_LENGTH)
      try {
        await ctx.database.create('shorturl', { id, url, count: 0 })
        return id
      } catch (error) {
        if (!RuntimeError.check(error, 'duplicate-entry')) {
          throw error
        }
      }
    }
  }

  function userShortcut(session: Session): string {
    return `${session.username} (${session.platform}:${session.userId})`
  }

  const logger = ctx.logger('shorturl')

  ctx.model.extend('shorturl', {
    id: 'string',
    url: 'string',
    count: 'unsigned',
  })

  ctx.command('shorturl <url:string>', '短网址生成器')
    .action(async ({ session }, url) => {
      if (!url || url.length > 1000) {
        return session.execute('help shorturl')
      }

      logger.info('shorturl', 'add', userShortcut(session), url)
      const id = await generate(url)
      return segment.quote(session.messageId) + ctx.options.selfUrl + config.path + id
    })
}
