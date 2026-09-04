import { describe, expect, it } from 'vitest'
import { PATROL_VIDEO, pickPatrolVideo, pickSurveyVideo, VIDEO_PACKS } from './video-packs'

describe('pickSurveyVideo 勘测实况选片', () => {
  it('日常巡航视频使用独立资源路径', () => {
    expect(PATROL_VIDEO).toBe('/videos/patrol/daily-inspection.mp4')
    expect(pickPatrolVideo(false, 'patrol')).toBe(PATROL_VIDEO)
    expect(pickPatrolVideo(true, 'patrol')).toBeNull()
    expect(pickPatrolVideo(false, 'survey')).toBeNull()
  })

  it('同一架机选片稳定', () => {
    expect(pickSurveyVideo('flood', 'drone-1', false)).toBe(pickSurveyVideo('flood', 'drone-1', false))
  })

  it('不同无人机选到不同视频（包内有多片时）', () => {
    const picks = ['drone-1', 'drone-2', 'drone-3', 'drone-4', 'drone-5', 'drone-6']
      .map((id) => pickSurveyVideo('fire', id, false))
    expect(new Set(picks).size).toBeGreaterThan(1) // 4 片 6 架机必然有区分
  })

  it('增援后切到包内下一片', () => {
    const before = pickSurveyVideo('debris', 'drone-2', false)
    const after = pickSurveyVideo('debris', 'drone-2', true)
    expect(after).not.toBe(before)
    const pack = VIDEO_PACKS.debris
    expect(pack.indexOf(after)).toBe((pack.indexOf(before) + 1) % pack.length)
  })

  it('所有返回路径都在对应灾种包内', () => {
    for (const kind of ['flood', 'fire', 'debris'] as const) {
      for (const id of ['drone-1', 'DJI-M350-R1', 'x9']) {
        expect(VIDEO_PACKS[kind]).toContain(pickSurveyVideo(kind, id, false))
        expect(VIDEO_PACKS[kind]).toContain(pickSurveyVideo(kind, id, true))
      }
    }
  })
})
