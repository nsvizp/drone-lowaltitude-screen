<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AMapLoader from '@amap/amap-jsapi-loader'
import { loadPublicConfig } from '@/api/config'
import { useDrones } from '@/composables/useDrones'
import { mulberry32, SHANGHAI_CENTER, type DroneState } from '@/sim/drone-sim'
import { createEmergencyData, type EmergencyCategory, type EmergencyPoint } from '@/sim/emergency-data'
import { useDisaster } from '@/composables/useDisaster'
import { backendOnline } from '@/api/socket'
import DispatchCard from '@/components/DispatchCard.vue'
import SituationCard from '@/components/SituationCard.vue'
import VideoFeed from '@/components/VideoFeed.vue'

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    AMap?: any
  }
}

type MapTheme = 'dark' | 'normal' | 'satellite'

const mapEl = ref<HTMLDivElement | null>(null)
const theme = ref<MapTheme>('dark')
const mapError = ref('')
const selected = ref<DroneState | null>(null)

const { routes, drones, summary } = useDrones()
const disaster = useDisaster()

/** 方舱固定点位（演示数据） */
const SHELTERS = [
  { id: 4001, name: '1号方舱', position: [121.4990, 31.2410] as [number, number] },
  { id: 4002, name: '2号方舱', position: [121.4450, 31.1890] as [number, number] },
  { id: 4003, name: '3号方舱', position: [121.5950, 31.2050] as [number, number] },
  { id: 4004, name: '4号方舱', position: [121.3330, 31.2000] as [number, number] },
]

/** 应急资源图层元数据 */
const EMERGENCY_LAYERS: { key: EmergencyCategory; label: string; color: string; icon: string }[] = [
  { key: 'supplies', label: '模拟物资', color: '#ffd666', icon: '📦' },
  { key: 'personnel', label: '应急人员', color: '#52d273', icon: '👷' },
  { key: 'vehicles', label: '应急车辆', color: '#ff6b6b', icon: '🚒' },
]

/** 应急资源数据：人员/车辆为模拟（确定性 seed）；物资点异步替换为仓储台账（与投送航线同源） */
const emergencyData = reactive(createEmergencyData(mulberry32(20260903)))
fetch('/api/warehouses')
  .then((r) => (r.ok ? r.json() : null))
  .then((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return
    emergencyData.supplies = rows.map((w: { id: number; name: string; org: string; items: string; stock: number; lng: number; lat: number }) => ({
      id: 'supply-' + w.id,
      category: 'supplies' as const,
      name: w.name,
      position: [w.lng, w.lat] as [number, number],
      detail: w.items + ' · 库存 ' + w.stock + ' 件',
      status: '可用',
      org: w.org,
    }))
  })
  .catch(() => undefined)

/** 图层显隐：默认全部不显示 */
const layerVisibility = ref<Record<EmergencyCategory, boolean>>({
  supplies: false,
  personnel: false,
  vehicles: false,
})

const layerMarkers: Record<EmergencyCategory, any[]> = { supplies: [], personnel: [], vehicles: [] }

/** 巡航航线底图（默认隐藏） */
const routeLines: any[] = []
const routeVisible = ref(false)
function toggleRoutes() {
  routeVisible.value = !routeVisible.value
  for (const line of routeLines) line.setMap(routeVisible.value ? map : null)
}

/** 每架机的航迹尾线与动态计划航线 */
const trackLines = new Map<string, any>()
const plannedLines = new Map<string, any>()
/** 洪灾覆盖物 */
let floodOverlays: any[] = []

let map: any = null
let satelliteLayer: any = null
const droneMarkers = new Map<string, any>()
let disposed = false

/** B4：全局唯一 InfoWindow，无人机弹窗内容随 tick 实时刷新 */
let infoWin: any = null
let infoDroneId: string | null = null
let lastInfoContent = ''

function getInfoWin(): any {
  const AMap = window.AMap
  if (!infoWin) {
    infoWin = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -24) })
    infoWin.on('close', () => { infoDroneId = null })
  }
  return infoWin
}

function openDroneInfo(d: DroneState) {
  infoDroneId = d.id
  const html = droneInfoHtml(d)
  lastInfoContent = html
  const win = getInfoWin()
  win.setContent(html)
  win.open(map, [d.lng, d.lat])
}

function openStaticInfo(content: string, position: [number, number]) {
  infoDroneId = null
  lastInfoContent = content
  const win = getInfoWin()
  win.setContent(content)
  win.open(map, position)
}

const STATUS_COLOR: Record<DroneState['status'], string> = {
  flying: '#00e5ff',
  hovering: '#ffd666',
  returning: '#a66bff',
  docked: '#3a5578',
}

function droneMarkerHtml(d: DroneState): string {
  const color = STATUS_COLOR[d.status]
  return (
    '<div class="drone-marker" style="--c:' + color + '">' +
    '<div class="drone-marker__icon" style="transform:rotate(' + d.heading + 'deg)">🛩</div>' +
    '<div class="drone-marker__label">' + d.name + '</div>' +
    '</div>'
  )
}

function droneInfoHtml(d: DroneState): string {
  const statusText = d.status === 'flying' ? '飞行中' : d.status === 'returning' ? '返航中' : '悬停'
  return (
    '<div style="background:#0a2140;color:#d8e6ff;padding:10px 14px;border:1px solid #2f80ed;border-radius:6px;font-size:12px;min-width:180px">' +
    '<div style="font-size:14px;font-weight:700;color:#00e5ff;margin-bottom:6px">' + d.name + '</div>' +
    '<div>任务：' + d.taskName + '</div>' +
    '<div>航线：' + d.routeName + '</div>' +
    '<div>高度：' + d.altitude + ' m　速度：' + d.speed.toFixed(1) + ' m/s</div>' +
    '<div>电量：' + d.battery + '%　状态：' + statusText + '</div>' +
    '<button class="js-video-btn" data-drone="' + d.id + '" style="margin-top:8px;width:100%;padding:5px 0;background:linear-gradient(90deg,#2f80ed,#56ccf2);border:none;border-radius:4px;color:#fff;font-size:12px;cursor:pointer">📹 观看实时视频</button>' +
    '</div>'
  )
}

function emergencyMeta(category: EmergencyCategory) {
  return EMERGENCY_LAYERS.find((l) => l.key === category)!
}

function emergencyMarkerHtml(p: EmergencyPoint): string {
  const meta = emergencyMeta(p.category)
  return (
    '<div class="emergency-marker" style="--c:' + meta.color + '">' +
    '<div class="emergency-marker__icon">' + meta.icon + '</div>' +
    '<div class="emergency-marker__label">' + p.name + '</div>' +
    '</div>'
  )
}

function emergencyInfoHtml(p: EmergencyPoint): string {
  const meta = emergencyMeta(p.category)
  return (
    '<div style="background:#0a2140;color:#d8e6ff;padding:10px 14px;border:1px solid ' + meta.color + ';border-radius:6px;font-size:12px;min-width:190px">' +
    '<div style="font-size:14px;font-weight:700;color:' + meta.color + ';margin-bottom:6px">' + meta.icon + ' ' + p.name + '</div>' +
    '<div>类别：' + meta.label + '</div>' +
    '<div>明细：' + p.detail + '</div>' +
    '<div>单位：' + p.org + '</div>' +
    '<div>状态：' + p.status + '</div>' +
    '</div>'
  )
}

function applyTheme(t: MapTheme) {
  if (!map || !window.AMap) return
  const AMap = window.AMap
  if (t === 'satellite') {
    map.setMapStyle('amap://styles/normal')
    if (!satelliteLayer) satelliteLayer = new AMap.TileLayer.Satellite()
    map.add(satelliteLayer)
  } else {
    if (satelliteLayer) map.remove(satelliteLayer)
    map.setMapStyle(t === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal')
  }
}

function setTheme(t: MapTheme) {
  theme.value = t
  applyTheme(t)
}

function toggleLayer(key: EmergencyCategory) {
  layerVisibility.value[key] = !layerVisibility.value[key]
  const visible = layerVisibility.value[key]
  for (const m of layerMarkers[key]) visible ? m.show() : m.hide()
}

/** 渲染应急资源图层（可重入：supplies 异步替换为仓储台账后重绘） */
function renderEmergencyLayers() {
  if (!map || !window.AMap) return
  const AMap = window.AMap
  for (const layer of EMERGENCY_LAYERS) {
    for (const m of layerMarkers[layer.key]) map.remove(m)
    layerMarkers[layer.key] = []
    for (const p of emergencyData[layer.key]) {
      const marker = new AMap.Marker({
        map,
        position: p.position,
        content: emergencyMarkerHtml(p),
        offset: new AMap.Pixel(-30, -20),
      })
      marker.on('click', () => openStaticInfo(emergencyInfoHtml(p), p.position))
      if (!layerVisibility.value[layer.key]) marker.hide() // B6：尊重加载前的勾选
      layerMarkers[layer.key].push(marker)
    }
  }
}

// 仓储台账坐标到达后重绘物资图层（与投送航线同源）
watch(() => emergencyData.supplies, () => renderEmergencyLayers())

async function initMap() {
  const config = await loadPublicConfig()
  const key = config.amapKey
  if (!key) {
    mapError.value = '未配置高德地图 Key：后端 system_config 表与 .env.local 均未提供'
    return
  }
  try {
    if (config.amapSecurityCode) window._AMapSecurityConfig = { securityJsCode: config.amapSecurityCode }
    const AMap = await AMapLoader.load({ key, version: '2.0' })
    if (disposed || !mapEl.value) return
    map = new AMap.Map(mapEl.value, {
      center: SHANGHAI_CENTER,
      zoom: 11,
      viewMode: '2D',
      mapStyle: 'amap://styles/darkblue',
    })
    // 调试/验收钩子
    ;(window as unknown as Record<string, unknown>).__MAP = map

    // 巡航航线底图：默认隐藏（仿真仍沿航线飞行），图层控件可开启
    const ROUTE_COLORS = ['#00e5ff', '#56ccf2', '#52d273', '#ffd666', '#a66bff', '#ff9a6b']
    routes.value.forEach((route, i) => {
      const line = new AMap.Polyline({
        path: route.points,
        strokeColor: ROUTE_COLORS[i % ROUTE_COLORS.length],
        strokeWeight: 3,
        strokeOpacity: 0.8,
        strokeStyle: 'dashed',
        lineJoin: 'round',
      })
      routeLines.push(line)
      if (routeVisible.value) line.setMap(map) // B6：加载前已勾选则直接上图
    })

    // 方舱
    for (const s of SHELTERS) {
      new AMap.Marker({
        map,
        position: s.position,
        content: '<div class="shelter-marker">🏠<span>' + s.name + '</span></div>',
        offset: new AMap.Pixel(-30, -14),
      })
    }

    // 应急资源图层（默认隐藏）
    renderEmergencyLayers()
  

    // 无人机初始 marker
    for (const d of drones.value) createDroneMarker(d)

    applyTheme(theme.value)
  } catch (e) {
    mapError.value = '高德地图加载失败：' + (e instanceof Error ? e.message : String(e))
  }
}

function createDroneMarker(d: DroneState) {
  const AMap = window.AMap
  const marker = new AMap.Marker({
    map,
    position: [d.lng, d.lat],
    content: droneMarkerHtml(d),
    offset: new AMap.Pixel(-40, -20),
  })
  marker.on('click', () => openDroneInfo(d))
  droneMarkers.set(d.id, marker)
  return marker
}

const PLANNED_COLOR: Record<string, string> = { survey: '#ff6b6b', delivery: '#ffd666' }

/** P1：marker 内容缓存（heading 量化 5° 桶 + 状态），不变不重建 DOM */
const markerContentCache = new Map<string, string>()
/** P2：航迹颜色缓存，变化才调 setOptions */
const trackColorCache = new Map<string, string>()

// 实时同步无人机位置 + 航迹尾线 + 动态计划航线
watch(drones, (list) => {
  if (!map || !window.AMap) return
  const AMap = window.AMap
  for (const d of list) {
    let marker = droneMarkers.get(d.id)
    if (!marker) {
      marker = createDroneMarker(d) // 投送/增援机动态起飞
      markerContentCache.set(d.id, d.status + '|' + Math.round(d.heading / 5) * 5)
    }
    if (d.status === 'docked') {
      marker.hide()
      // 归舱后移除航迹与计划航线，避免模拟机残留地图
      const track = trackLines.get(d.id)
      if (track) { map.remove(track); trackLines.delete(d.id) }
      const planned0 = plannedLines.get(d.id)
      if (planned0) { map.remove(planned0); plannedLines.delete(d.id) }
      // B4/B5 联动：正在看的无人机归舱 → 关闭弹窗
      if (infoDroneId === d.id && infoWin) { infoWin.close(); infoDroneId = null }
      continue
    }
    marker.show()
    marker.setPosition([d.lng, d.lat])

    // P1：内容缓存——状态或朝向桶变化才重建 DOM
    const contentKey = d.status + '|' + Math.round(d.heading / 5) * 5
    if (markerContentCache.get(d.id) !== contentKey) {
      marker.setContent(droneMarkerHtml(d))
      markerContentCache.set(d.id, contentKey)
    }

    // B4：弹窗开着时随 tick 刷新内容与位置
    if (infoDroneId === d.id && infoWin) {
      const html = droneInfoHtml(d)
      if (html !== lastInfoContent) {
        lastInfoContent = html
        infoWin.setContent(html)
      }
      infoWin.setPosition([d.lng, d.lat])
    }

    // 航迹尾线（实线渐隐）
    if (d.track.length > 1) {
      let line = trackLines.get(d.id)
      const color = STATUS_COLOR[d.status]
      if (!line) {
        line = new AMap.Polyline({
          map, strokeColor: color, strokeWeight: 2,
          strokeOpacity: 0.45, lineJoin: 'round', showDir: true,
        })
        trackLines.set(d.id, line)
        trackColorCache.set(d.id, color)
      }
      line.setPath(d.track)
      // P2：颜色跟随实时状态，但只在变化时调用
      if (trackColorCache.get(d.id) !== color) {
        line.setOptions({ strokeColor: color })
        trackColorCache.set(d.id, color)
      }
    }

    // 动态计划航线（改派/投送时虚线指向目标）
    let planned = plannedLines.get(d.id)
    if (d.mission !== 'patrol' && d.plannedRoute && d.plannedRoute.length > 0) {
      const path = [[d.lng, d.lat], ...d.plannedRoute]
      if (!planned) {
        planned = new AMap.Polyline({
          map, strokeColor: PLANNED_COLOR[d.mission] ?? '#00e5ff', strokeWeight: 3,
          strokeOpacity: 0.9, strokeStyle: 'dashed', lineJoin: 'round',
        })
        plannedLines.set(d.id, planned)
      }
      planned.setPath(path)
    } else if (planned) {
      map.remove(planned)
      plannedLines.delete(d.id)
    }
  }
})

// 洪灾覆盖物：红色警戒圈 + 脉冲标记 + 视野定位
watch(disaster.flood, (f) => {
  if (!map || !window.AMap) return
  const AMap = window.AMap
  if (floodOverlays.length) { map.remove(floodOverlays); floodOverlays = [] }
  if (!f) return
  const isDebris = f.kind === 'debris'
  const disasterColor = isDebris ? '#c08a3e' : '#ff3b3b'
  const circle = new AMap.Circle({
    map, center: f.position, radius: 400 * f.severity,
    strokeColor: disasterColor, strokeWeight: 2, strokeOpacity: 0.8,
    fillColor: disasterColor, fillOpacity: 0.12,
  })
  const pulse = new AMap.Marker({
    map, position: f.position,
    content: '<div class="flood-pulse"><span>' + (isDebris ? '⛰️' : '🌊') + '</span></div>',
    offset: new AMap.Pixel(-16, -16),
  })
  floodOverlays = [circle, pulse]
  map.panTo(f.position)
})

// InfoWindow 内「观看实时视频」按钮（事件委托）
function onVideoBtnClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.js-video-btn') as HTMLElement | null
  if (btn?.dataset.drone) disaster.openVideo(btn.dataset.drone)
}

onMounted(() => {
  initMap()
  document.addEventListener('click', onVideoBtnClick)
})
onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('click', onVideoBtnClick)
  droneMarkers.clear()
  layerMarkers.supplies = []
  layerMarkers.personnel = []
  layerMarkers.vehicles = []
  map?.destroy()
  map = null
})
</script>

<template>
  <section class="center-map">
    <div ref="mapEl" class="center-map__canvas" />

    <div v-if="mapError" class="center-map__fallback">
      <div class="center-map__fallback-inner">
        <div class="center-map__fallback-icon">🗺️</div>
        <p>{{ mapError }}</p>
      </div>
    </div>

    <div class="center-map__fleet">
      <span class="center-map__chip center-map__chip--fly">飞行中 {{ summary.flying }}</span>
      <span class="center-map__chip center-map__chip--return">返航 {{ summary.returning }}</span>
      <span class="center-map__chip center-map__chip--warn">低电量 {{ summary.lowBattery }}</span>
    </div>

    <div class="center-map__layers">
      <div class="center-map__layers-title">图层</div>
      <button
        class="center-map__layer"
        :class="{ 'center-map__layer--on': routeVisible }"
        @click="toggleRoutes"
      >
        <span class="center-map__layer-check">{{ routeVisible ? '☑' : '☐' }}</span>
        <span class="center-map__layer-icon">🛣</span>
        巡航航线
      </button>
      <button
        v-for="l in EMERGENCY_LAYERS"
        :key="l.key"
        class="center-map__layer"
        :class="{ 'center-map__layer--active': layerVisibility[l.key] }"
        :style="{ '--layer-color': l.color }"
        @click="toggleLayer(l.key)"
      >
        <span class="center-map__layer-check">{{ layerVisibility[l.key] ? '✓' : '' }}</span>
        {{ l.icon }} {{ l.label }}
        <span class="center-map__layer-count">{{ emergencyData[l.key].length }}</span>
      </button>
      <div
        class="center-map__backend"
        :class="{ 'center-map__backend--offline': !backendOnline }"
        :title="backendOnline ? '后端在线：模拟/灾情数据来自服务端' : '后端离线：请检查后端服务（:3000）'"
      >
        {{ backendOnline ? '● 后端在线' : '○ 后端离线' }}
      </div>
      <button
        class="center-map__disaster"
        :disabled="disaster.active.value || !backendOnline"
        @click="disaster.simulateFlood('flood')"
      >
        {{ disaster.active.value ? '🔴 抢险进行中…' : '⚠ 模拟洪灾' }}
      </button>
      <button
        class="center-map__disaster center-map__disaster--debris"
        :disabled="disaster.active.value || !backendOnline"
        @click="disaster.simulateFlood('debris')"
      >
        {{ disaster.active.value ? '🔴 抢险进行中…' : '⛰ 模拟泥石流' }}
      </button>
      <button
        v-if="disaster.active.value"
        class="center-map__disaster center-map__disaster--resolve"
        @click="disaster.resolveDisaster"
      >
        ✅ 结束演练
      </button>
    </div>

    <DispatchCard />
    <SituationCard />
    <VideoFeed />

    <div class="center-map__themes">
      <button
        class="center-map__theme"
        :class="{ 'center-map__theme--active': theme === 'satellite' }"
        @click="setTheme('satellite')"
      >卫星图</button>
      <button
        class="center-map__theme"
        :class="{ 'center-map__theme--active': theme === 'normal' }"
        @click="setTheme('normal')"
      >电子地图</button>
      <button
        class="center-map__theme"
        :class="{ 'center-map__theme--active': theme === 'dark' }"
        @click="setTheme('dark')"
      >暗色主题</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.center-map {
  position: relative;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  overflow: hidden;
  background: rgba(6, 24, 48, 0.5);

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      repeating-linear-gradient(0deg, rgba(47, 128, 237, 0.06) 0 1px, transparent 1px 40px),
      repeating-linear-gradient(90deg, rgba(47, 128, 237, 0.06) 0 1px, transparent 1px 40px);

    &-inner {
      max-width: 420px;
      text-align: center;
      color: var(--text-dim);
      font-size: 13px;
      line-height: 1.8;
    }

    &-icon { font-size: 42px; margin-bottom: 10px; }
  }

  &__fleet {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  &__chip {
    padding: 4px 10px;
    font-size: 12px;
    border-radius: 4px;
    background: rgba(6, 24, 48, 0.85);
    border: 1px solid var(--panel-border);

    &--fly { color: var(--accent); }
    &--return { color: #a66bff; }
    &--warn { color: var(--warn); }
  }

  &__layers {
    position: absolute;
    top: 48px;
    left: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(6, 24, 48, 0.85);
    border: 1px solid var(--panel-border);
    border-radius: 6px;

    &-title {
      font-size: 11px;
      color: var(--text-dim);
      letter-spacing: 2px;
      padding: 0 4px 2px;
    }
  }

  &__layer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 6px;
    font-size: 12px;
    color: var(--text-main);
    background: rgba(6, 24, 48, 0.7);
    border: 1px solid rgba(47, 128, 237, 0.3);
    border-radius: 4px;
    cursor: pointer;
    text-align: left;

    &--active {
      border-color: var(--layer-color);
      box-shadow: inset 0 0 10px rgba(0, 229, 255, 0.08);
    }

    &-check {
      width: 14px;
      height: 14px;
      border: 1px solid var(--panel-border);
      border-radius: 3px;
      font-size: 10px;
      line-height: 13px;
      text-align: center;
      color: var(--layer-color);
    }

    &-count {
      margin-left: auto;
      font-family: var(--font-num);
      font-size: 11px;
      color: var(--layer-color);
    }
  }

  &__backend {
    margin-top: 4px;
    padding: 3px 8px;
    font-size: 11px;
    color: #7ef29b;
    background: rgba(46, 204, 113, 0.12);
    border: 1px solid rgba(46, 204, 113, 0.4);
    border-radius: 4px;
    text-align: center;

    &--offline {
      color: #ff9b9b;
      background: rgba(255, 59, 59, 0.15);
      border-color: rgba(255, 59, 59, 0.5);
      animation: backend-blink 1.2s ease-in-out infinite;
    }
  }

  @keyframes backend-blink {
    50% { opacity: 0.5; }
  }

  &__disaster {
    margin-top: 4px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #ffb3b3;
    background: rgba(255, 59, 59, 0.15);
    border: 1px solid rgba(255, 59, 59, 0.5);
    border-radius: 4px;
    cursor: pointer;

    &:hover:not(:disabled) { background: rgba(255, 59, 59, 0.3); }
    &:disabled { opacity: 0.7; cursor: default; }

    &--debris {
      color: #e8c79b;
      background: rgba(192, 138, 62, 0.15);
      border-color: rgba(192, 138, 62, 0.5);

      &:hover:not(:disabled) { background: rgba(192, 138, 62, 0.3); }
    }

    &--resolve {
      color: #9be89b;
      background: rgba(46, 204, 113, 0.15);
      border-color: rgba(46, 204, 113, 0.5);

      &:hover { background: rgba(46, 204, 113, 0.3); }
    }
  }

  &__themes {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  &__theme {
    padding: 6px 14px;
    font-size: 13px;
    color: var(--text-main);
    background: rgba(6, 24, 48, 0.85);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    cursor: pointer;

    &--active {
      background: linear-gradient(90deg, var(--primary), var(--primary-light));
      color: #fff;
      border-color: transparent;
    }
  }
}
</style>

<style>
/* 高德 marker 自定义内容（非 scoped） */
.drone-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 0 6px var(--c));
}

.drone-marker__icon {
  font-size: 22px;
  line-height: 1;
  transition: transform 0.5s linear;
}

.drone-marker__label {
  pointer-events: none;
  margin-top: 2px;
  font-size: 10px;
  color: var(--c);
  background: rgba(4, 20, 43, 0.8);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.emergency-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 0 5px var(--c));
}

.emergency-marker__icon {
  font-size: 18px;
  line-height: 1;
}

.emergency-marker__label {
  pointer-events: none;
  margin-top: 2px;
  font-size: 10px;
  color: var(--c);
  background: rgba(4, 20, 43, 0.8);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.flood-pulse {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  animation: flood-blink 1s ease-in-out infinite;
}

.flood-pulse::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid #ff3b3b;
  animation: flood-ring 1.5s ease-out infinite;
}

@keyframes flood-ring {
  0% { transform: scale(0.5); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes flood-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.shelter-marker {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  color: #ffd666;
}

.shelter-marker span {
  font-size: 11px;
  color: #ffe9a8;
  background: rgba(4, 20, 43, 0.8);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
</style>
