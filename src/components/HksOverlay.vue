<template>
  <section
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="hks-title"
    data-testid="hks-overlay"
  >
    <header class="header">
      <div class="heading">
        <h1 id="hks-title">山西古建保卫战</h1>
        <p>移动 · 自动攻击 · 守护五分钟</p>
      </div>
      <button ref="returnButton" type="button" data-testid="hks-return" @click="emit('close')">
        返回校园
      </button>
    </header>

    <main class="game">
      <iframe
        :key="frameKey"
        ref="frame"
        :src="offlineHtml ? undefined : gameUrl"
        :srcdoc="offlineHtml"
        title="山西古建保卫战"
        data-testid="hks-frame"
        @error="fail"
      />
      <div v-if="!ready && !error" class="status" role="status" data-testid="hks-loading">
        游戏加载中…
      </div>
      <div v-else-if="error" class="status" role="alert" data-testid="hks-error">
        <p>游戏加载失败，请重试。</p>
        <button type="button" data-testid="hks-retry" @click="retry">重新加载</button>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{ close: [] }>()
const offlineHtml = import.meta.env.VITE_OFFLINE_BUILD === 'true' ? (window as Window & { __HKS_OFFLINE_HTML__?: string }).__HKS_OFFLINE_HTML__ : undefined
// file:// srcdoc messages serialize their inherited opaque origin as null.
const expectedOrigin = offlineHtml && location.protocol === 'file:' ? 'null' : location.origin
const gameUrl = `${import.meta.env.BASE_URL}games/hks/index.html`
const frame = ref<HTMLIFrameElement | null>(null)
const returnButton = ref<HTMLButtonElement | null>(null)
const frameKey = ref(0)
const ready = ref(false)
const error = ref(false)
let timer: number | undefined
let previousFocus: HTMLElement | null = null
let mounted = false
let accepting = false

function clearTimer() {
  window.clearTimeout(timer)
}

function fail() {
  clearTimer()
  ready.value = false
  error.value = true
}

function startTimer() {
  clearTimer()
  timer = window.setTimeout(fail, 20_000)
}

async function retry() {
  accepting = false
  ready.value = false
  error.value = false
  frameKey.value++
  startTimer()
  await nextTick()
  if (mounted) accepting = true
}

function onMessage(event: MessageEvent) {
  if (!accepting || event.origin !== expectedOrigin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'hks:return') emit('close')
  else if (event.data?.type === 'hks:ready') {
    clearTimer()
    ready.value = true
    error.value = false
  } else if (event.data?.type === 'hks:error') fail()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  mounted = true
  accepting = true
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKeydown)
  startTimer()
  returnButton.value?.focus()
})

onUnmounted(() => {
  mounted = false
  accepting = false
  clearTimer()
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKeydown)
  if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus()
})
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  height: 100dvh;
  overflow: hidden;
  background: #17130f;
  color: #fff;
}
.header {
  box-sizing: border-box;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
}
.heading { min-width: 0; }
h1 { margin: 0; font-size: 1.1rem; }
.heading p { margin: 4px 0 0; font-size: 0.8rem; }
button { min-width: 44px; min-height: 44px; padding: 8px 12px; cursor: pointer; background:#f4ead0; color:#392615; border:1px solid #b38b48; border-radius:6px; }
button:focus-visible { outline:2px solid #edc76a; outline-offset:3px; }
.game { position: relative; height: calc(100dvh - 72px); min-height: 200px; }
iframe { display: block; width: 100%; height: 100%; min-height: 200px; border: 0; }
.status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #17130f;
  text-align: center;
}
</style>
