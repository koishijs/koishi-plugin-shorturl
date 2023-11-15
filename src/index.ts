import { Context, Schema, segment } from 'koishi'
import * as service from './service'
export { service }

export const KEY_LENGTH = 6

export const name = 'shorturl'
export const inject = ['router']

export interface Config {
  path?: string
  selfUrl?: string
}

export const Config: Schema<Config> = Schema.object({
  path: Schema.string().description('短链接路由。').default('/s'),
  selfUrl: Schema.string().role('link').description('服务暴露在公网的地址。缺省时将使用全局配置。'),
})

export function apply(ctx: Context, config: Config) {
  ctx.plugin(service.ShorturlService, config)

  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

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

  ctx.inject(['shorturl'], (ctx) => {
    ctx.command('shorturl <url:rawtext>')
      .action(async ({ session }, url) => {
        if (!url) {
          return session.execute('help shorturl')
        }

        const { username, platform, userId, messageId } = session
        const prefix = segment.quote(messageId) + ctx.shorturl.getUrlPrefix()

        const id = await ctx.shorturl.generate(url)
        logger.info('shorturl', 'add', `${username} (${platform}:${userId})`, url)
        return prefix + id
      })
  })
}
