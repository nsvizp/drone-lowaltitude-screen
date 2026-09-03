<script setup lang="ts">
import { useScreenScale } from '@/composables/useScreenScale'
import { useDisaster } from '@/composables/useDisaster'
import TopBar from './screen/TopBar.vue'
import LeftPanel from './screen/LeftPanel.vue'
import RightPanel from './screen/RightPanel.vue'
import CenterMap from './screen/CenterMap.vue'

const { scale, offsetX, offsetY } = useScreenScale()
const disaster = useDisaster()
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
        灾点 {{ disaster.flood.value!.position[0].toFixed(4) }}, {{ disaster.flood.value!.position[1].toFixed(4) }} ·
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
