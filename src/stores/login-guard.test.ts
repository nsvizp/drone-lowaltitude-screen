import { describe, expect, it } from 'vitest'
import {
  checkPasswordStrength,
  initialGuard,
  lockRemainSec,
  recordFailure,
  recordSuccess,
  LOCK_DURATION_MS,
  LOCK_THRESHOLD,
} from './login-guard'

describe('checkPasswordStrength 强密码校验', () => {
  it('符合全部规则的密码通过', () => {
    expect(checkPasswordStrength('Admin@2026').ok).toBe(true)
  })

  it('长度不足 8 位被拒绝', () => {
    const r = checkPasswordStrength('Ad@12')
    expect(r.ok).toBe(false)
    expect(r.problems).toContain('长度至少 8 位')
  })

  it('缺少大写/小写/数字/符号分别被拒绝并给出原因', () => {
    expect(checkPasswordStrength('admin@2026').problems).toContain('需包含大写字母')
    expect(checkPasswordStrength('ADMIN@2026').problems).toContain('需包含小写字母')
    expect(checkPasswordStrength('Admin@abcd').problems).toContain('需包含数字')
    expect(checkPasswordStrength('Admin2026').problems).toContain('需包含特殊符号')
  })

  it('弱密码 admin123 给出全部缺失项', () => {
    const r = checkPasswordStrength('admin123')
    expect(r.ok).toBe(false)
    expect(r.problems.length).toBeGreaterThanOrEqual(2) // 缺大写、缺符号
  })
})

describe('登录错误锁定', () => {
  const now = 1_000_000

  it('前 N-1 次失败只计数不锁定', () => {
    let g = initialGuard
    for (let i = 0; i < LOCK_THRESHOLD - 1; i++) g = recordFailure(g, now)
    expect(g.lockedUntil).toBe(0)
    expect(lockRemainSec(g, now)).toBe(0)
  })

  it('第 5 次失败触发锁定', () => {
    let g = initialGuard
    for (let i = 0; i < LOCK_THRESHOLD; i++) g = recordFailure(g, now)
    expect(g.lockedUntil).toBe(now + LOCK_DURATION_MS)
    expect(lockRemainSec(g, now)).toBe(LOCK_DURATION_MS / 1000)
  })

  it('锁定倒计时随时间递减，过期后归零', () => {
    const g = { failCount: 0, lockedUntil: now + LOCK_DURATION_MS }
    expect(lockRemainSec(g, now + 60_000)).toBe(240)
    expect(lockRemainSec(g, now + LOCK_DURATION_MS + 1)).toBe(0)
  })

  it('锁定后重新计数：锁定期间失败不延长锁定', () => {
    let g = { failCount: 0, lockedUntil: now + LOCK_DURATION_MS }
    g = recordFailure(g, now + 1000) // 锁定中再次尝试
    expect(g.lockedUntil).toBe(now + LOCK_DURATION_MS) // 不延长
  })

  it('登录成功清零失败计数', () => {
    let g = initialGuard
    g = recordFailure(g, now)
    g = recordFailure(g, now)
    g = recordSuccess(g)
    expect(g).toEqual(initialGuard)
  })
})
