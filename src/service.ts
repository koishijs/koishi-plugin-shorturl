import { Context, RuntimeError, Service } from 'koishi'
import { parse, stringify } from 'querystring'
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

    ctx.router.all(config.path + '/:path(.+)', async (koa) => {
      this.logger.debug('[request] %s', koa.url.slice(config.path.length))
      const { path } = koa.params
      const [id] = path.split('/', 1)
      if (id.length === KEY_LENGTH) {
        const [data] = await ctx.database.get('shorturl', id)
        if (data) {
          const url = new URL(data.url)
          const query = stringify({
            ...parse(url.search.slice(1)),
            ...koa.query,
          })
          url.pathname += path.slice(KEY_LENGTH)
          url.search = query ? '?' + query : ''
          koa.redirect(url.href)
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
    const [data] = await this.ctx.database.get('shorturl', { url })
    if (data) {
      return this.prefix + data.id
    }
    let id: string
    while (true) {
      id = Math.random().toString(36).slice(2, 2 + KEY_LENGTH)
      try {
        await this.ctx.database.create('shorturl', { id, url, count: 0 })
        this.logger.debug('[create] %s -> %s', id, url)
        return this.prefix + id
      } catch (error) {
        if (!RuntimeError.check(error, 'duplicate-entry')) {
          throw error
        }
      }
    }
  }
}
