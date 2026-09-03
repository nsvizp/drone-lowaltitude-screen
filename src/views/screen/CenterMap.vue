<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AMapLoader from '@amap/amap-jsapi-loader'
import { useDrones } from '@/composables/useDrones'
import { SHANGHAI_CENTER, type DroneState } from '@/sim/drone-sim'

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

const { routes, drones, summary } = useDrones(8)

/** 方舱固定点位（演示数据） */
const SHELTERS = [
  { id: 4001, name: '1号方舱', position: [121.4990, 31.2410] as [number, number] },
  { id: 4002, name: '2号方舱', position: [121.4450, 31.1890] as [number, number] },
  { id: 4003, name: '3号方舱', position: [121.5950, 31.2050] as [number, number] },
  { id: 4004, name: '4号方舱', position: [121.3330, 31.2000] as [number, number] },
]

let map: any = null
let satelliteLayer: any = null
const droneMarkers = new Map<string, any>()
let disposed = false

const STATUS_COLOR: Record<DroneState['status'], string> = {
  flying: '#00e5ff',
  hovering: '#ffd666',
  returning: '#a66bff',
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

async function initMap() {
  const key = import.meta.env.VITE_AMAP_KEY
  if (!key) {
    mapError.value = '未配置高德地图 Key：请在项目根目录创建 .env.local，填入 VITE_AMAP_KEY 与 VITE_AMAP_SECURITY_CODE（参考 .env.example）'
    return
  }
  try {
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE
    if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode }
    const AMap = await AMapLoader.load({ key, version: '2.0' })
    if (disposed || !mapEl.value) return
    map = new AMap.Map(mapEl.value, {
      center: SHANGHAI_CENTER,
      zoom: 11,
      viewMode: '2D',
      mapStyle: 'amap://styles/darkblue',
    })

    // 航线
    const ROUTE_COLORS = ['#00e5ff', '#56ccf2', '#52d273', '#ffd666', '#a66bff', '#ff9a6b']
    routes.value.forEach((route, i) => {
      new AMap.Polyline({
        map,
        path: route.points,
        strokeColor: ROUTE_COLORS[i % ROUTE_COLORS.length],
        strokeWeight: 3,
        strokeOpacity: 0.8,
        strokeStyle: 'dashed',
        lineJoin: 'round',
      })
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

    // 无人机初始 marker
    for (const d of drones.value) {
      const marker = new AMap.Marker({
        map,
        position: [d.lng, d.lat],
        content: droneMarkerHtml(d),
        offset: new AMap.Pixel(-40, -20),
      })
      marker.on('click', () => {
        selected.value = d
        new AMap.InfoWindow({
          content: droneInfoHtml(d),
          offset: new AMap.Pixel(0, -24),
        }).open(map, [d.lng, d.lat])
      })
      droneMarkers.set(d.id, marker)
    }

    applyTheme(theme.value)
  } catch (e) {
    mapError.value = '高德地图加载失败：' + (e instanceof Error ? e.message : String(e))
  }
}

// 实时同步无人机位置
watch(drones, (list) => {
  if (!map) return
  for (const d of list) {
    const marker = droneMarkers.get(d.id)
    if (!marker) continue
    marker.setPosition([d.lng, d.lat])
    marker.setContent(droneMarkerHtml(d))
  }
})

onMounted(initMap)
onBeforeUnmount(() => {
  disposed = true
  droneMarkers.clear()
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
