<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useClock } from '@/composables/useClock'
import { useAuthStore } from '@/stores/auth'

const { clock } = useClock()
const auth = useAuthStore()
const router = useRouter()

// 天气为演示静态数据（真实场景接气象接口）
const weather = { text: '多云', temperature: '31' }

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__left">
      <span class="topbar__time">{{ clock.time.slice(0, 5) }}</span>
      <span class="topbar__weekday">{{ clock.weekday }}</span>
      <span class="topbar__date">{{ clock.date }}</span>
      <span class="topbar__weather">☁ {{ weather.temperature }}°C</span>
    </div>

    <h1 class="topbar__title">应急指挥调度平台</h1>

    <div class="topbar__right">
      <button class="topbar__home" @click="onLogout">🔔 首页</button>
      <span class="topbar__user">{{ auth.displayName }}</span>
      <span class="topbar__avatar">{{ auth.displayName.charAt(0) || 'A' }}</span>
    </div>
  </header>
</template>

<style scoped lang="scss">
.topbar {
  position: relative;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: linear-gradient(180deg, rgba(9, 36, 74, 0.9), rgba(4, 20, 43, 0));
  border-bottom: 1px solid rgba(47, 128, 237, 0.25);

  &__left {
    display: flex;
    align-items: baseline;
    gap: 16px;
    width: 420px;
  }

  &__time {
    font-family: var(--font-num);
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
  }

  &__weekday,
  &__date,
  &__weather {
    font-size: 14px;
    color: var(--text-main);
  }

  &__title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 32px;
    letter-spacing: 8px;
    font-weight: 700;
    background: linear-gradient(180deg, #ffffff 20%, #6fb7ff 90%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 24px rgba(0, 229, 255, 0.25);
    white-space: nowrap;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 420px;
    justify-content: flex-end;
  }

  &__home {
    padding: 6px 14px;
    background: rgba(47, 128, 237, 0.15);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text-main);
    font-size: 13px;
    cursor: pointer;

    &:hover { background: rgba(47, 128, 237, 0.3); }
  }

  &__user { font-size: 14px; }

  &__avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary), var(--primary-light));
    color: #fff;
    font-weight: 700;
  }
}
</style>