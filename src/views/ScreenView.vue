<script setup lang="ts">
import { useScreenScale } from '@/composables/useScreenScale'
import TopBar from './screen/TopBar.vue'
import LeftPanel from './screen/LeftPanel.vue'
import RightPanel from './screen/RightPanel.vue'
import CenterMap from './screen/CenterMap.vue'

const { scale, offsetX, offsetY } = useScreenScale()
</script>

<template>
  <div class="screen-scale-viewport">
    <div
      class="screen-scale-stage screen"
      :style="{ transform: 'scale(' + scale + ')', left: offsetX + 'px', top: offsetY + 'px' }"
    >
      <TopBar />
      <main class="screen__main">
        <LeftPanel class="screen__left" />
        <CenterMap class="screen__center" />
        <RightPanel class="screen__right" />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
