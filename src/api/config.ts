/** 启动期公开配置：本地环境变量优先，后端公开配置兜底 */

interface PublicConfig {
  amapKey: string
  amapSecurityCode: string
}

let cached: PublicConfig | null = null

export async function loadPublicConfig(): Promise<PublicConfig> {
  if (cached) return cached
  let fromServer: Record<string, string> = {}
  try {
    const res = await fetch('/api/config/public')
    if (res.ok) fromServer = await res.json()
  } catch {
    // 后端未启动：静默回退到本地 env
  }
  cached = {
    // 本地开发密钥只保存在 Git 忽略的 .env.local 中，避免写入受版本控制的数据库。
    amapKey: import.meta.env.VITE_AMAP_KEY || fromServer['amap.key'] || '',
    amapSecurityCode: import.meta.env.VITE_AMAP_SECURITY_CODE || fromServer['amap.securityCode'] || '',
  }
  return cached
}
