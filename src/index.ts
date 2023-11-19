import { Context, h, Schema } from 'koishi'
import { ShorturlService } from './service'

export * from './service'

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
  ctx.plugin(ShorturlService, config)

  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))

  ctx.inject(['shorturl'], (ctx) => {
    ctx.command('shorturl <url:rawtext>')
      .action(async ({ session }, source) => {
        if (!source) {
          return session.execute('help shorturl')
        }

        try {
          new URL(source)
        } catch (error) {
          return session.text('.invalid-url')
        }

        const url = await ctx.shorturl.generate(source)
        return h.quote(session.messageId) + url
      })
  })
}
