<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { journeyStage, type JourneyState } from '../games/journey';
const props = defineProps<{ state: JourneyState | null; campusId: string; saved?: boolean }>();
const emit = defineEmits<{ start: []; continue: []; restart: []; 'free-roam': []; flight: []; confirming: [open: boolean] }>();
const stage = computed(() => props.state ? journeyStage(props.state) : null);
const title = computed(() => ({ hall: '第一站 · 机械馆钟楼', garden: '第二站 · 清泽园花间', platform: '第三站 · 登高看校园', flight: '最后一页 · 放飞纸飞机', complete: '晴日手记 · 完成' })[stage.value ?? 'hall']);
const detail = computed(() => ({ hall: '走到机械馆前，转动镜头，把钟楼收入画中。', garden: '沿路走向清泽园，在花岛北侧寻找垂枝树。', platform: '沿台阶走上原创观景低台，再调整镜头拍下高处的花园。', flight: '沿台阶走下低台，靠近旁边的折叠站；依次穿过三道门并抵达终点。', complete: '三次驻足，一次放飞。这一轮校园旅程已记下。' })[stage.value ?? 'hall']);
const confirmation = ref<HTMLDialogElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;
async function confirmRestart() {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  emit('confirming', true);
  confirmation.value?.showModal();
  await nextTick(); cancelButton.value?.focus();
}
function closeConfirmation(restart = false) {
  confirmation.value?.close(); emit('confirming', false);
  if (restart) emit('restart');
  returnFocus?.focus();
}
</script>
<template>
  <section class="journey-card" data-testid="journey-panel" aria-labelledby="journey-heading">
    <span class="eyebrow">晴日 · 太理手记 <b v-if="state">{{ state.photos.length }} / 3 张</b></span>
    <template v-if="campusId !== 'yingxi'">
      <h2 id="journey-heading">虎峪 · 自在探索</h2><p>继续原校园探索章；晴日摄影与纸飞机手记在迎西等你。</p>
    </template>
    <template v-else-if="!state">
      <h2 id="journey-heading">把校园，写成一段晴日</h2>
      <p>机械馆与清泽园取景 → 沿台阶登高 → 放飞纸飞机。Hks 是随时可选的另一场冒险。</p>
      <div class="actions"><button class="primary" @click="emit('start')">开始手记</button><button @click="emit('free-roam')">先去漫游</button></div>
    </template>
    <template v-else>
      <h2 id="journey-heading">{{ title }}</h2><p>{{ detail }}</p>
      <ol class="steps" aria-label="本轮手记进度"><li :class="{ done: state.photos.includes('hall') }">{{ state.photos.includes('hall') ? '✓' : '1' }} 钟楼</li><li :class="{ done: state.photos.includes('garden') }">{{ state.photos.includes('garden') ? '✓' : '2' }} 花间</li><li :class="{ done: state.photos.includes('platform') }">{{ state.photos.includes('platform') ? '✓' : '3' }} 登高</li><li :class="{ done: state.flightCompleted }">{{ state.flightCompleted ? '✓' : '4' }} 放飞</li></ol>
      <p v-if="state.bestFlight !== null" class="best">最佳完成用时 {{ state.bestFlight.toFixed(1) }} 秒</p>
      <div class="actions">
        <button v-if="stage === 'flight' || stage === 'complete'" class="primary" @click="emit('flight')">{{ stage === 'complete' ? '再飞一次' : '准备放飞' }}</button>
        <button v-else class="primary" @click="emit('continue')">继续手记</button>
        <button @click="emit('free-roam')">继续漫游</button><button @click="confirmRestart">另开一轮</button>
      </div>
    </template>
    <small class="save-note">{{ saved === false ? '本次未能保存进度：仍可游玩，离开页面将丢失未保存的新进度。照片请下载。' : '浏览器允许时，进度会保存在本机；照片仅本次会话可用，请下载留存。' }}</small>
  </section>
  <Teleport to="body"><dialog ref="confirmation" class="restart-dialog" aria-labelledby="restart-title" @cancel.prevent="closeConfirmation()">
    <h2 id="restart-title">另开一轮手记？</h2><p>本轮三张照片与放飞进度将重新开始。旧地标探索和已有摄影印记不会删除。</p>
    <div class="actions"><button ref="cancelButton" @click="closeConfirmation()">保留这一轮</button><button @click="closeConfirmation(true)">确认重新开始</button></div>
  </dialog></Teleport>
</template>
<style scoped>
.journey-card{background:#f7f4e8ed;color:#284639;border:1px solid #cfdbcc;border-radius:16px;padding:18px;max-width:410px;box-shadow:0 8px 30px #17392b18}.eyebrow{font-size:12px;letter-spacing:.12em;color:#78634a}.eyebrow b{float:right;letter-spacing:0}.journey-card h2,.restart-dialog h2{font-size:21px;margin:8px 0}.journey-card p,.restart-dialog p{font-size:14px;line-height:1.65;margin:8px 0}.steps{display:flex;gap:10px;list-style:none;padding:0;font-size:12px;color:#667368}.steps .done{color:#256341;font-weight:700}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}button{min-height:44px;padding:9px 14px;border:1px solid #a6b7a6;border-radius:9px;background:#fffdf5;color:#274333;cursor:pointer;font:inherit;font-size:14px}button.primary{background:#315b43;color:#fff;border-color:#315b43}button:focus-visible{outline:3px solid #ba703f;outline-offset:3px}.save-note{display:block;font-size:11px;line-height:1.5;color:#596c5b;margin-top:12px}.best{color:#875a35}.restart-dialog{max-width:430px;width:calc(100% - 32px);box-sizing:border-box;border:1px solid #adbea9;border-radius:16px;padding:24px;background:#f7f4e8;color:#284639}.restart-dialog::backdrop{background:#152f28a8}@media(max-height:500px){.journey-card{padding:12px;max-width:350px}.journey-card h2{font-size:18px}.journey-card p{font-size:12px}.save-note{font-size:10px}}
</style>
