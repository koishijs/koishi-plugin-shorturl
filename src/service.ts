import { Context, RuntimeError, Service } from 'koishi'
import { Config } from '.'

const KEY_LENGTH = 6

export interface Shorturl {
  id: string
  url: string
  count: number
}

declare module 'koishi' {
  interface Context {
    shorturl: ShorturlService
  }

  interface Tables {
    shorturl: Shorturl
  }
}

export class ShorturlService extends Service {
  public prefix: string

  constructor(ctx: Context, protected config: Config) {
    super(ctx, 'shorturl', true)

    const { path, selfUrl } = config
    this.prefix = (selfUrl || this.ctx.router.config.selfUrl) + path + '/'

    ctx.model.extend('shorturl', {
      id: 'string',
      url: 'string',
      count: 'unsigned',
    })

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
  }

  async generate(url: string) {
    const data = await this.ctx.database.get('shorturl', { url })
    if (data.length) {
      return data[0].id
    }
    let id: string
    while (true) {
      id = Math.random().toString(36).slice(2, 2 + KEY_LENGTH)
      try {
        await this.ctx.database.create('shorturl', { id, url, count: 0 })
        this.logger.info('[create] %s -> %s', id, url)
        return this.prefix + id
      } catch (error) {
        if (!RuntimeError.check(error, 'duplicate-entry')) {
          throw error
        }
      }
    }
  }
}
