/** 登录安全守卫：强密码校验 + 连续失败锁定（纯函数，可测） */

export interface PasswordCheck {
  ok: boolean
  problems: string[]
}

/** 强密码规则：≥8 位 + 大小写字母 + 数字 + 特殊符号 */
export function checkPasswordStrength(pw: string): PasswordCheck {
  const problems: string[] = []
  if (pw.length < 8) problems.push('长度至少 8 位')
  if (!/[A-Z]/.test(pw)) problems.push('需包含大写字母')
  if (!/[a-z]/.test(pw)) problems.push('需包含小写字母')
  if (!/\d/.test(pw)) problems.push('需包含数字')
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push('需包含特殊符号')
  return { ok: problems.length === 0, problems }
}

/** 连续失败锁定阈值 */
export const LOCK_THRESHOLD = 5
/** 锁定时长：5 分钟 */
export const LOCK_DURATION_MS = 5 * 60 * 1000

export interface GuardState {
  failCount: number
  lockedUntil: number
}

export const initialGuard: GuardState = { failCount: 0, lockedUntil: 0 }

/** 剩余锁定秒数（0 表示未锁定） */
export function lockRemainSec(g: GuardState, now: number): number {
  return Math.max(0, Math.ceil((g.lockedUntil - now) / 1000))
}

/** 记录一次失败；达到阈值触发锁定（锁定期间的失败不延长锁定、不计数） */
export function recordFailure(g: GuardState, now: number): GuardState {
  if (lockRemainSec(g, now) > 0) return g
  const failCount = g.failCount + 1
  if (failCount >= LOCK_THRESHOLD) return { failCount: 0, lockedUntil: now + LOCK_DURATION_MS }
  return { failCount, lockedUntil: 0 }
}

/** 登录成功：清零 */
export function recordSuccess(g: GuardState): GuardState {
  return { ...initialGuard }
}

// ---------- 持久化（刷新页面锁定不丢失） ----------
const GUARD_KEY = 'login-guard'

export function loadGuard(): GuardState {
  try {
    const raw = localStorage.getItem(GUARD_KEY)
    if (!raw) return { ...initialGuard }
    const parsed = JSON.parse(raw) as GuardState
    return { failCount: parsed.failCount ?? 0, lockedUntil: parsed.lockedUntil ?? 0 }
  } catch {
    return { ...initialGuard }
  }
}

export function saveGuard(g: GuardState): void {
  localStorage.setItem(GUARD_KEY, JSON.stringify(g))
}
