import { SetMetadata } from '@nestjs/common'

/** 公开路由标记：带此装饰器的接口跳过全局认证守卫 */
export const IS_PUBLIC_KEY = 'dsh:isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
