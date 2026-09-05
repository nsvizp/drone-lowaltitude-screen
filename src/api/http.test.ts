import { describe, expect, it } from 'vitest'
import { isJwtUsable } from './http'

function tokenWithExpiry(exp: number): string {
  const payload = btoa(JSON.stringify({ sub: 1, exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return 'header.' + payload + '.signature'
}

describe('isJwtUsable', () => {
  const now = 2_000_000_000_000

  it('未到期的 JWT 可用', () => {
    expect(isJwtUsable(tokenWithExpiry(now / 1000 + 60), now)).toBe(true)
  })

  it('过期、缺少 exp 或格式异常的 JWT 不可用', () => {
    expect(isJwtUsable(tokenWithExpiry(now / 1000 - 1), now)).toBe(false)
    expect(isJwtUsable('header.' + btoa('{}') + '.signature', now)).toBe(false)
    expect(isJwtUsable('invalid-token', now)).toBe(false)
  })
})
