import type { DroneState } from './drone-sim'

export type VideoSource =
  | { type: 'simulated'; scene: 'city' | 'flood' }
  | { type: 'flv'; url: string }

/**
 * 视频源选择：真实接入时每架机配置 flv 地址即走真流；
 * 当前按任务状态返回模拟画面场景（巡逻=城市，勘测洪灾=水面）。
 */
export function getVideoSource(drone: DroneState): VideoSource {
  return { type: 'simulated', scene: drone.mission === 'survey' ? 'flood' : 'city' }
}

/** HUD 遥测文本（图传画面四角叠加） */
export function formatHudTelemetry(drone: DroneState): string[] {
  return [
    'ALT ' + drone.altitude + ' M',
    'BAT ' + drone.battery.toFixed(1) + '%',
    'SPD ' + drone.speed.toFixed(1) + ' M/S',
    drone.lng.toFixed(4) + ', ' + drone.lat.toFixed(4),
  ]
}

/** 图传信号格数（1~5，演示：电量越高信号越好） */
export function signalBars(drone: DroneState): number {
  if (drone.battery >= 80) return 5
  if (drone.battery >= 60) return 4
  if (drone.battery >= 40) return 3
  if (drone.battery >= 25) return 2
  return 1
}
