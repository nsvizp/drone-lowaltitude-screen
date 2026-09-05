/** 登录 token 的 localStorage 键（与 auth.ts 登录流程一致） */
export const TOKEN_KEY = 'drone-screen-token'

/** JWT 到期或格式异常时视为无效，避免页面有旧 token 但 WebSocket 一直离线。 */
export function isJwtUsable(token: string, now = Date.now()): boolean {
  if (!token) return false
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return false
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    return typeof payload.exp === 'number' && payload.exp * 1000 > now
  } catch {
    return false
  }
}

export function getToken(): string {
  const token = localStorage.getItem(TOKEN_KEY) ?? ''
  if (isJwtUsable(token)) return token
  if (token) localStorage.removeItem(TOKEN_KEY)
  return ''
}

/** 带 Bearer 认证的 fetch（登录后所有受保护接口统一走这里） */
export function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(path, { ...init, headers })
}
