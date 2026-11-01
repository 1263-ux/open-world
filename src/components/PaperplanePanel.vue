<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PaperplaneInput, PaperplaneSnapshot } from '../shared/contracts';
const props = defineProps<{ snapshot: PaperplaneSnapshot }>();
const emit = defineEmits<{ launch: []; retry: []; exit: []; resume: []; input: [input: PaperplaneInput] }>();
const root = ref<HTMLElement | null>(null);
const primary = ref<HTMLButtonElement | null>(null);
const controls = new Map<number, { axis: 'turn' | 'pitch'; value: number }>();
const resultText = computed(() => ({ success: '三道门与终点，全部抵达！', collision: '飞机碰到了景物。调整方向再试一次。', 'missed-gate': '错过了一道门。按顺序瞄准下一道光圈。', 'out-of-bounds': '飞出了活动范围。转弯稍缓一些。', timeout: '飞行时间到了。沿目标门继续向前。', cancelled: '本次放飞已结束。' })[props.snapshot.result ?? 'cancelled']);
function sendInput() {
  let turn = 0, pitch = 0;
  controls.forEach(item => { if (item.axis === 'turn') turn += item.value; else pitch += item.value; });
  emit('input', { turn: Math.max(-1, Math.min(1, turn)), pitch: Math.max(-1, Math.min(1, pitch)) });
}
function clearInput() { controls.clear(); sendInput(); }
function press(event: PointerEvent, axis: 'turn' | 'pitch', value: number) {
  if (props.snapshot.paused || props.snapshot.phase !== 'flying') return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  controls.set(event.pointerId, { axis, value }); sendInput();
}
function release(event: PointerEvent) { controls.delete(event.pointerId); sendInput(); }
function action(name: 'launch' | 'retry' | 'exit' | 'resume') { clearInput(); if (name === 'launch') emit('launch'); else if (name === 'retry') emit('retry'); else if (name === 'resume') emit('resume'); else emit('exit'); }
function keys(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); action('exit'); }
  if (event.key !== 'Tab' || (props.snapshot.phase === 'flying' && !props.snapshot.paused)) return;
  const buttons = Array.from(root.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
  else if (!event.shiftKey && (index < 0 || index === buttons.length - 1)) { event.preventDefault(); buttons[0]?.focus(); }
}
watch(() => `${props.snapshot.phase}:${props.snapshot.paused}`, async () => {
  clearInput(); await nextTick();
  if (props.snapshot.phase !== 'flying' || props.snapshot.paused) primary.value?.focus();
}, { immediate: true });
onMounted(() => { window.addEventListener('blur', clearInput); window.addEventListener('resize', clearInput); document.addEventListener('visibilitychange', clearInput); });
onBeforeUnmount(() => { clearInput(); window.removeEventListener('blur', clearInput); window.removeEventListener('resize', clearInput); document.removeEventListener('visibilitychange', clearInput); });
</script>
<template>
  <section ref="root" class="plane-panel" :class="{ flying: snapshot.phase === 'flying' && !snapshot.paused }" :role="snapshot.phase === 'flying' && !snapshot.paused ? 'region' : 'dialog'" aria-labelledby="plane-title" data-testid="paperplane-panel" @keydown="keys">
    <div class="plane-heading"><span class="eyebrow">晴日 · 纸飞机</span><button class="exit" @click="action('exit')">退出放飞 <span aria-hidden="true">×</span></button></div>
    <template v-if="snapshot.paused"><h2 id="plane-title">放飞已暂停</h2><p>飞行计时已停。准备好后继续，或回到折叠站。</p><button ref="primary" class="primary" @click="action('resume')">继续飞行</button></template>
    <template v-else-if="snapshot.phase === 'ready'"><h2 id="plane-title">折好纸翼，向晴日出发</h2><p>在桌前准备，放飞镜头转向桌外的三道门。自动向前飞行，依次穿过三道门，再抵达终点。碰撞、漏门或越界都可立即重试。</p><p class="controls-help">A / D 或 ← / → 转向 · W / S 或 ↑ / ↓ 抬头 / 低头<br>触屏使用下方方向按钮。Esc 随时退出。</p><button ref="primary" class="primary" @click="action('launch')">开始放飞</button></template>
    <template v-else-if="snapshot.phase === 'result'"><h2 id="plane-title">{{ snapshot.result === 'success' ? '让晴日落进手记' : '再换一条飞行弧线' }}</h2><p role="status">{{ resultText }}</p><p>{{ snapshot.gatesPassed }} / {{ snapshot.gateCount }} 道门 · {{ snapshot.elapsed.toFixed(1) }} 秒</p><div class="actions"><button ref="primary" class="primary" @click="action('retry')">再飞一次</button><button @click="action('exit')">{{ snapshot.result === 'success' ? '返回手记' : '回到折叠站' }}</button></div></template>
    <template v-else><h2 id="plane-title">{{ snapshot.gatesPassed < snapshot.gateCount ? `前往第 ${snapshot.gatesPassed + 1} 道门` : '前往终点' }}</h2><p class="flight-progress">{{ snapshot.gatesPassed }} / {{ snapshot.gateCount }} 道门 · {{ snapshot.elapsed.toFixed(1) }} 秒</p>
      <div class="touch-controls" aria-label="飞行触屏控制">
        <button aria-label="向左转" @pointerdown="press($event, 'turn', -1)" @pointerup="release" @pointercancel="release" @lostpointercapture="release">←<small>左转</small></button>
        <div class="pitch"><button aria-label="抬头" @pointerdown="press($event, 'pitch', 1)" @pointerup="release" @pointercancel="release" @lostpointercapture="release">↑ 抬头</button><button aria-label="低头" @pointerdown="press($event, 'pitch', -1)" @pointerup="release" @pointercancel="release" @lostpointercapture="release">↓ 低头</button></div>
        <button aria-label="向右转" @pointerdown="press($event, 'turn', 1)" @pointerup="release" @pointercancel="release" @lostpointercapture="release">→<small>右转</small></button>
      </div>
    </template>
    <small class="design-note">游戏原创短航线 · 点代理碰撞 · 非真实飞行动力学</small>
  </section>
</template>
<style scoped>
.plane-panel{position:absolute;z-index:12;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100% - 32px));box-sizing:border-box;padding:22px;border:1px solid #b6c7b1;border-radius:18px;background:#f7f4e8f5;color:#294635;box-shadow:0 12px 60px #19392b45}.plane-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#80623f}h2{font-size:23px;margin:12px 0}p{font-size:14px;line-height:1.65;margin:10px 0}button{min-width:44px;min-height:44px;border:1px solid #a5b7a3;border-radius:9px;background:#fffdf5;color:#294635;padding:9px 14px;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid #bc7547;outline-offset:3px}.exit{font-size:12px}.primary{background:#315b43;color:white;border-color:#315b43}.actions{display:flex;gap:10px}.controls-help{color:#5b6e5b}.design-note{display:block;font-size:10px;color:#63745f;margin-top:14px}.flying{top:18px;transform:translateX(-50%);padding:12px 16px;width:310px;background:#f7f4e8e8}.flying h2{font-size:18px;margin:6px 0}.flight-progress{margin:4px 0}.touch-controls{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px}.touch-controls button{touch-action:none;user-select:none;min-width:64px;min-height:52px}.touch-controls small{display:block;font-size:10px}.pitch{display:grid;gap:6px}.pitch button{font-size:12px}.flying .design-note{display:none}@media(max-height:500px){.plane-panel{padding:12px 18px;max-height:calc(100% - 20px);overflow:auto}.plane-panel h2{font-size:19px}.plane-panel p{font-size:12px}.flying{left:auto;right:12px;top:12px;transform:none;width:260px}.touch-controls{gap:6px;margin-top:4px}.touch-controls button{min-height:44px}}
</style>
