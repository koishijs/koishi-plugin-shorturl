import { Context, RuntimeError, Service } from 'koishi'
import { Config, KEY_LENGTH } from '.'

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
  constructor(ctx: Context, protected config: Config) {
    super(ctx, 'shorturl', true)
    ctx.model.extend('shorturl', {
      id: 'string',
      url: 'string',
      count: 'unsigned',
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
        return id
      } catch (error) {
        if (!RuntimeError.check(error, 'duplicate-entry')) {
          throw error
        }
      }
    }
  }

  getUrlPrefix() {
    return (this.config.selfUrl || this.ctx.root.config.selfUrl) + this.config.path + '/'
  }
}
