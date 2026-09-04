import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { ExecutionContext } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from './auth.guard'

const jwt = new JwtService({ secret: 'test-secret-0123456789abcdef0123456789' })
const reflector = new Reflector()
const guard = new AuthGuard(jwt, reflector)

/** 构造最小 HTTP ExecutionContext（isPublic 元数据 + 请求头） */
function ctx(opts: { isPublic?: boolean; auth?: string }): ExecutionContext {
  const handler = () => undefined
  const cls = class {}
  if (opts.isPublic) {
    Reflect.defineMetadata('dsh:isPublic', true, handler)
    Reflect.defineMetadata('dsh:isPublic', true, cls)
  }
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ headers: opts.auth ? { authorization: opts.auth } : {} }),
    }),
  } as unknown as ExecutionContext
}

describe('AuthGuard 全局认证守卫', () => {
  it('@Public 路由无 token 放行', async () => {
    await expect(guard.canActivate(ctx({ isPublic: true }))).resolves.toBe(true)
  })

  it('无 Authorization 头 → 401', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toThrow()
  })

  it('伪造 token → 401', async () => {
    await expect(guard.canActivate(ctx({ auth: 'Bearer forged.fake.token' }))).rejects.toThrow()
  })

  it('合法 token → 放行并把用户载到 request', async () => {
    const token = await jwt.signAsync({ sub: 1, username: 'admin', role: 'admin' })
    const c = ctx({ auth: 'Bearer ' + token })
    await expect(guard.canActivate(c)).resolves.toBe(true)
  })

  it('过期 token → 401', async () => {
    const expired = await jwt.signAsync({ sub: 1, username: 'admin' }, { expiresIn: '-1s' })
    await expect(guard.canActivate(ctx({ auth: 'Bearer ' + expired }))).rejects.toThrow()
  })
})
