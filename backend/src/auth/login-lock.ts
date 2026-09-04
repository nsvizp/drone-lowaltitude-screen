/** 服务端登录锁定：滑动窗口内失败满阈值即锁定（纯函数，可测） */

export const LOCK_THRESHOLD = 5
export const LOCK_WINDOW_MS = 5 * 60 * 1000
export const LOCK_DURATION_MS = 5 * 60 * 1000

export interface LockInput {
  /** 该用户最近的失败尝试时间戳（升序） */
  failures: number[]
  now: number
}

/** 计算当前锁定剩余秒数（0 = 未锁定） */
export function lockRemainSec(input: LockInput): number {
  const windowStart = input.now - LOCK_WINDOW_MS
  const recent = input.failures.filter((t) => t > windowStart)
  if (recent.length < LOCK_THRESHOLD) return 0
  // 从最近一次（第 5 次）失败时刻起锁 5 分钟
  const lockStart = recent[recent.length - 1]
  const remain = lockStart + LOCK_DURATION_MS - input.now
  return Math.max(0, Math.ceil(remain / 1000))
}

/** 距离下次失败重置还差几次机会 */
export function attemptsLeft(input: LockInput): number {
  const windowStart = input.now - LOCK_WINDOW_MS
  const recent = input.failures.filter((t) => t > windowStart)
  return Math.max(0, LOCK_THRESHOLD - recent.length)
}
