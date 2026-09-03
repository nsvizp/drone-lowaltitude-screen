<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="panel-card">
    <header class="panel-card__header">
      <span class="panel-card__corner" />
      <h3 class="panel-card__title">{{ title }}</h3>
      <span class="panel-card__line" />
    </header>
    <div class="panel-card__body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.panel-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px 8px;
  }

  &__corner {
    width: 8px;
    height: 8px;
    border-left: 2px solid var(--accent);
    border-top: 2px solid var(--accent);
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 2px;
    color: #eaf3ff;
    white-space: nowrap;
  }

  &__line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--panel-border), transparent);
  }

  &__body {
    flex: 1;
    padding: 6px 14px 12px;
    overflow: hidden;
    min-height: 0;
  }
}
</style>
