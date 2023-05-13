import { Context, RuntimeError, Schema, segment } from 'koishi'

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
  path?: string
  selfUrl?: string
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().description('短链接路由。').default('/s'),
  selfUrl: Schema.string().role('link').description('服务暴露在公网的地址。缺省时将使用全局配置。'),
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

  ctx.i18n.define('zh', require('./locales/zh'))

  ctx.router.all(config.path + '/:id', async (koa) => {
    const { id } = koa.params
    if (id.length === KEY_LENGTH) {
      const data = await ctx.database.get('shorturl', id)
      if (data.length) {
        koa.redirect(data[0].url)
      } else {
        koa.status = 404
      }
    } else {
      koa.status = 404
    }
    if (koa.status === 404) {
      koa.body = 'The shorturl you requested is not found on this server.'
    }
  })

  const logger = ctx.logger('shorturl')

  ctx.model.extend('shorturl', {
    id: 'string',
    url: 'string',
    count: 'unsigned',
  })

  ctx.command('shorturl <url:rawtext>')
    .action(async ({ session }, url) => {
      if (!url) {
        return session.execute('help shorturl')
      }

      const { username, platform, userId, messageId } = session
      const prefix = segment.quote(messageId) + (config.selfUrl || ctx.root.config.selfUrl) + config.path + '/'
      const data = await ctx.database.get('shorturl', { url })
      if (data.length) {
        return prefix + data[0].id
      }

      logger.info('shorturl', 'add', `${username} (${platform}:${userId})`, url)
      const id = await generate(url)
      return prefix + id
    })
}
