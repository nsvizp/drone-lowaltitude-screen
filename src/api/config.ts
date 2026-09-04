/** 启动期公开配置：后端 /api/config/public 优先，.env.local 兜底（后端未起时可离线开发） */

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
    amapKey: fromServer['amap.key'] ?? import.meta.env.VITE_AMAP_KEY ?? '',
    amapSecurityCode: fromServer['amap.securityCode'] ?? import.meta.env.VITE_AMAP_SECURITY_CODE ?? '',
  }
  return cached
}
