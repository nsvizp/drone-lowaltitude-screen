import type { DisasterKind } from './disaster'

/** 各灾种的勘测实况视频包（public/videos/<kind>/ 下） */
export const VIDEO_PACKS: Record<DisasterKind, string[]> = {
  flood: ['/videos/flood/01.mp4', '/videos/flood/02.mp4', '/videos/flood/03.mp4'],
  fire: ['/videos/fire/01.mp4', '/videos/fire/02.mp4', '/videos/fire/03.mp4', '/videos/fire/04.mp4'],
  debris: ['/videos/debris/01.mp4', '/videos/debris/02.mp4'],
}

/** 稳定字符串散列（同一架机永远拿到同一基准片） */
export function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 为勘测机选实况视频：
 * - 不同无人机 → 不同视频（按 droneId 散列）
 * - 增援执行后 → 切到包内下一片（画面轮换，体现"增援到场换机位"）
 */
export function pickSurveyVideo(kind: DisasterKind, droneId: string, reinforced: boolean): string {
  const pack = VIDEO_PACKS[kind] ?? VIDEO_PACKS.flood
  const idx = (hashCode(droneId) + (reinforced ? 1 : 0)) % pack.length
  return pack[idx]
}
