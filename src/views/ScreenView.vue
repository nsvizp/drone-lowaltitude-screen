<script setup lang="ts">
import { computed } from 'vue'
import { useScreenScale } from '@/composables/useScreenScale'
import { useDisaster } from '@/composables/useDisaster'
import TopBar from './screen/TopBar.vue'
import LeftPanel from './screen/LeftPanel.vue'
import RightPanel from './screen/RightPanel.vue'
import CenterMap from './screen/CenterMap.vue'

const { scale, offsetX, offsetY } = useScreenScale()
const disaster = useDisaster()

/** 当前演示灾点经公开地图数据反查后对应的地点名称 */
const DISASTER_LOCATION_NAME = '上海市浦东新区金杨新村街道云山路'

const disasterCoordinate = computed(() => {
  const position = disaster.flood.value?.position
  if (!position) return null
  return {
    compact: `${position[0].toFixed(2)}, ${position[1].toFixed(2)}`,
    full: `${position[0].toFixed(4)}, ${position[1].toFixed(4)}`,
  }
})
</script>

<template>
  <div class="screen-scale-viewport">
    <div
      class="screen-scale-stage screen"
      :style="{ transform: 'scale(' + scale + ')', left: offsetX + 'px', top: offsetY + 'px' }"
    >
      <TopBar />
      <div v-if="disaster.active.value" class="alarm-banner">
        🚨 洪灾报警 · {{ 'ⅠⅡⅢ'[disaster.flood.value!.severity - 1] }} 级 ·
        灾点 {{ DISASTER_LOCATION_NAME }}
        <span
          v-if="disasterCoordinate"
          class="alarm-coordinate"
          tabindex="0"
          :aria-label="`完整经纬度 ${disasterCoordinate.full}`"
        >
          （{{ disasterCoordinate.compact }}）
          <span class="alarm-coordinate__tooltip" role="tooltip">
            {{ disasterCoordinate.full }}
          </span>
        </span>
        ·
        抢险勘测与物资投送进行中
      </div>
      <main class="screen__main">
        <LeftPanel class="screen__left" />
        <CenterMap class="screen__center" />
        <RightPanel class="screen__right" />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.alarm-banner {
  margin: 0 16px;
  padding: 8px 0;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #fff;
  background: linear-gradient(90deg, rgba(192, 57, 43, 0.9), rgba(255, 59, 59, 0.95), rgba(192, 57, 43, 0.9));
  border: 1px solid #ff6b6b;
  border-radius: 4px;
  animation: alarm-flash 0.9s ease-in-out infinite;
}

.alarm-coordinate {
  position: relative;
  display: inline-block;
  padding-bottom: 1px;
  color: #ffe8e8;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.72);
  cursor: help;
  outline: none;

  &:focus-visible {
    border-bottom-color: #fff;
    box-shadow: 0 2px 0 rgba(255, 255, 255, 0.9);
  }

  &:hover .alarm-coordinate__tooltip,
  &:focus-visible .alarm-coordinate__tooltip {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, 0);
  }

  &__tooltip {
    position: absolute;
    z-index: 20;
    left: 50%;
    bottom: calc(100% + 8px);
    visibility: hidden;
    padding: 6px 10px;
    color: #dffaff;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.5px;
    white-space: nowrap;
    background: rgba(4, 25, 51, 0.96);
    border: 1px solid #56ccf2;
    border-radius: 3px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.36);
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 4px);
    transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s;

    &::after {
      position: absolute;
      top: 100%;
      left: 50%;
      width: 7px;
      height: 7px;
      content: '';
      background: #041933;
      border-right: 1px solid #56ccf2;
      border-bottom: 1px solid #56ccf2;
      transform: translate(-50%, -4px) rotate(45deg);
    }
  }
}

@keyframes alarm-flash {
  0%, 100% { opacity: 1; box-shadow: 0 0 24px rgba(255, 59, 59, 0.6); }
  50% { opacity: 0.55; box-shadow: none; }
}

.screen {
  display: flex;
  flex-direction: column;

  &__main {
    flex: 1;
    display: grid;
    grid-template-columns: 400px 1fr 400px;
    gap: 16px;
    padding: 12px 16px 16px;
    min-height: 0;
  }

  &__left,
  &__right,
  &__center {
    min-height: 0;
    min-width: 0;
  }
}
</style>
