<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('admin')
const password = ref('')
const captchaInput = ref('')
const captchaCode = ref('')
const errorMsg = ref('')
const loading = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function drawCaptcha() {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]
  }
  captchaCode.value = code
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0a2140'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 干扰线
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = 'rgba(86, 204, 242, ' + (0.2 + Math.random() * 0.3) + ')'
    ctx.beginPath()
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height)
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height)
    ctx.stroke()
  }
  for (let i = 0; i < code.length; i++) {
    ctx.save()
    ctx.font = 'bold 24px monospace'
    ctx.fillStyle = ['#56ccf2', '#00e5ff', '#8ab8ff', '#52d273'][i % 4]
    ctx.translate(16 + i * 24, 30)
    ctx.rotate((Math.random() - 0.5) * 0.5)
    ctx.fillText(code[i], 0, 0)
    ctx.restore()
  }
}

async function onSubmit() {
  errorMsg.value = ''
  if (!username.value || !password.value) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  if (captchaInput.value.toUpperCase() !== captchaCode.value) {
    errorMsg.value = '验证码错误'
    drawCaptcha()
    captchaInput.value = ''
    return
  }
  loading.value = true
  try {
    await auth.login({ username: username.value, password: password.value })
    router.push({ name: 'screen' })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : '登录失败'
    drawCaptcha()
    captchaInput.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(drawCaptcha)
</script>

<template>
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">应急指挥调度平台</h1>
      <p class="login__subtitle">Low-Altitude UAV Command &amp; Dispatch Platform</p>
      <form class="login__form" @submit.prevent="onSubmit">
        <label class="login__field">
          <span>用户名</span>
          <input v-model="username" type="text" placeholder="请输入用户名" autocomplete="username" />
        </label>
        <label class="login__field">
          <span>密码</span>
          <input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
        </label>
        <label class="login__field">
          <span>验证码</span>
          <div class="login__captcha">
            <input v-model="captchaInput" type="text" maxlength="4" placeholder="验证码" />
            <canvas
              ref="canvasRef"
              class="login__captcha-canvas"
              width="110"
              height="40"
              title="点击刷新验证码"
              @click="drawCaptcha"
            />
          </div>
        </label>
        <p v-if="errorMsg" class="login__error">{{ errorMsg }}</p>
        <button class="login__submit" type="submit" :disabled="loading">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(47, 128, 237, 0.18), transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(0, 229, 255, 0.12), transparent 50%),
    var(--screen-bg);

  &__card {
    width: 400px;
    padding: 40px 36px;
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    box-shadow: 0 0 40px rgba(0, 229, 255, 0.12);
  }

  &__title {
    font-size: 24px;
    letter-spacing: 3px;
    text-align: center;
    background: linear-gradient(180deg, #fff, #8ab8ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  &__subtitle {
    margin-top: 6px;
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
    letter-spacing: 1px;
  }

  &__form {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--text-dim);

    input {
      height: 40px;
      padding: 0 12px;
      background: rgba(6, 24, 48, 0.9);
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;

      &:focus { border-color: var(--accent); }
    }
  }

  &__captcha {
    display: flex;
    gap: 10px;

    input { flex: 1; }

    &-canvas {
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      cursor: pointer;
    }
  }

  &__error {
    color: var(--warn);
    font-size: 12px;
    text-align: center;
  }

  &__submit {
    height: 42px;
    border: none;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    color: #fff;
    font-size: 16px;
    letter-spacing: 6px;
    cursor: pointer;
    transition: opacity 0.2s;

    &:disabled { opacity: 0.6; cursor: not-allowed; }
    &:hover:not(:disabled) { opacity: 0.9; }
  }
}
</style>