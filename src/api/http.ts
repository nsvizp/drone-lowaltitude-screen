/** 登录 token 的 localStorage 键（与 auth.ts 登录流程一致） */
export const TOKEN_KEY = 'drone-screen-token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

/** 带 Bearer 认证的 fetch（登录后所有受保护接口统一走这里） */
export function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(path, { ...init, headers })
}
