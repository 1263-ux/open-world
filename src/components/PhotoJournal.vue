<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { PHOTO_POINTS, type PhotoPoint } from '../games/photography';

const props = defineProps<{
  point: PhotoPoint;
  stamps: string[];
  photos: Record<string, string>;
  status: { inRange: boolean; framed: boolean; obstructed: boolean; distance: number } | null;
  disabled: boolean;
  viewAvailable: boolean;
  modelStatus: 'loading' | 'ready' | 'fallback';
  panelOpen: boolean;
  feedback: string;
  completeOpen: boolean;
}>();
const emit = defineEmits<{ record: []; close: []; open: []; replay: []; select: [id: string] }>();
const dialog = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
watch(() => props.completeOpen, async open => {
  if (open) { await nextTick(); closeButton.value?.focus(); }
});
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return;
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  if (!focusable.length) { event.preventDefault(); return; }
  const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
  else if (!event.shiftKey && (index === -1 || index === focusable.length - 1)) { event.preventDefault(); focusable[0]?.focus(); }
}
const downloading = ref(false);
const downloadError = ref(false);
const count = computed(() => props.stamps.length);
const hint = computed(() => {
  if (props.disabled) return '三维场景不可用，取景手记暂不可用';
  if (props.panelOpen) return '关闭地点面板后继续取景';
  if (!props.viewAvailable) return '请先返回人物视角，再继续取景';
  if (props.modelStatus === 'fallback') return '机械馆细节未能加载，暂无法记录钟楼';
  if (props.modelStatus === 'loading') return '机械馆细节正在加载，稍候即可取景';
  if (!props.status) return '正在寻找观察位置…';
  if (!props.status.inRange) return `向观察处靠近 · 约 ${Math.round(props.status.distance)} 米`;
  if (props.status.obstructed) return '钟楼被景物遮住了，换个位置看看';
  if (!props.status.framed) return '调整视角：钟面放进框内，塔顶完整入画';
  return '构图就绪 · 按 E 或轻触记录';
});
function imageFor(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url;
  });
}
async function downloadPostcard() {
  if (downloading.value || PHOTO_POINTS.some(point => !props.photos[point.id])) return;
  downloading.value = true; downloadError.value = false;
  try {
    const images = await Promise.all(PHOTO_POINTS.map(point => imageFor(props.photos[point.id]!)));
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1080;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas unavailable');
    ctx.fillStyle = '#f3f0e3'; ctx.fillRect(0, 0, 1600, 1080);
    ctx.fillStyle = '#234735'; ctx.fillRect(0, 0, 1600, 18);
    ctx.fillStyle = '#a76f4d'; ctx.font = '600 22px sans-serif'; ctx.fillText('TAIYUAN UNIVERSITY OF TECHNOLOGY  /  YINGXI', 88, 90);
    ctx.fillStyle = '#264838'; ctx.font = '600 56px serif'; ctx.fillText('晴日 · 太理手记', 88, 164);
    ctx.fillStyle = '#738674'; ctx.font = '24px sans-serif'; ctx.fillText('两次驻足，两张自己看见的校园。', 91, 211);
    const drawCover = (image: HTMLImageElement, x: number, y: number, w: number, h: number) => {
      const scale = Math.max(w / image.width, h / image.height);
      const sw = w / scale, sh = h / scale;
      ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
    };
    images.forEach((image, index) => {
      const x = 88 + index * 724; drawCover(image, x, 260, 700, 510);
      ctx.fillStyle = '#a76f4d'; ctx.font = '600 20px sans-serif'; ctx.fillText(`0${index + 1}  /  CAMPUS MOMENT`, x, 824);
      ctx.fillStyle = '#264838'; ctx.font = '600 31px serif'; ctx.fillText(PHOTO_POINTS[index]!.title, x, 870);
      ctx.fillStyle = '#748476'; ctx.font = '20px sans-serif'; ctx.fillText(PHOTO_POINTS[index]!.subtitle, x, 910);
    });
    ctx.strokeStyle = '#cbd2c5'; ctx.beginPath(); ctx.moveTo(88, 970); ctx.lineTo(1512, 970); ctx.stroke();
    ctx.fillStyle = '#586e5d'; ctx.font = '18px sans-serif';
    ctx.fillText('© OpenStreetMap contributors / Overture Maps Foundation · ODbL；East Asian Buildings · Shi et al.', 88, 997);
    ctx.fillText('3D-GloBFP · Che et al. · CC BY 4.0；高度为预测，景观含展示设计。', 88, 1025);
    ctx.fillStyle = '#738476'; ctx.font = '17px sans-serif';
    ctx.fillText('来源：docs.overturemaps.org/attribution  ·  doi.org/10.5281/zenodo.15487006', 88, 1053);
    const link = document.createElement('a'); link.download = '晴日-太理手记.png'; link.href = canvas.toDataURL('image/png'); link.click();
  } catch { downloadError.value = true; }
  finally { downloading.value = false; }
}
</script>

<template>
  <div class="photo-guide" data-testid="photo-guide">
    <div class="photo-guide-copy">
      <span class="photo-kicker">晴日 · 取景手记 <b>{{ count }} / 2</b></span>
      <strong>{{ point.title }}</strong>
      <small>{{ point.instruction }}</small>
      <span class="photo-hint" data-testid="photo-hint">{{ feedback || hint }}</span><span class="sr-only" aria-live="polite">{{ feedback }}</span>
    </div>
    <button v-if="count === 2" type="button" class="photo-open" @click="emit('open')">查看手记 ↗</button>
    <button type="button" class="photo-shutter" data-testid="photo-record" :disabled="disabled || panelOpen || modelStatus !== 'ready'" @click="emit('record')"><span aria-hidden="true">◎</span> 记录 <kbd>E</kbd></button>
  </div>
  <div v-if="status?.inRange && !disabled && !panelOpen && viewAvailable" class="photo-frame" :class="{ ready: status.framed && !status.obstructed }" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <Teleport to="body">
  <div v-if="completeOpen" class="postcard-backdrop">
  <section ref="dialog" class="postcard-sheet" data-testid="photo-complete" role="dialog" aria-modal="true" aria-labelledby="postcard-title" @keydown="trapFocus">
    <button ref="closeButton" class="postcard-close" type="button" aria-label="关闭手记" @click="emit('close')">×</button>
    <span class="photo-kicker">TWO MOMENTS / YINGXI</span>
    <h2 id="postcard-title">把晴日，<br>留在手记里</h2>
    <p>两处驻足，两枚自己发现的校园印记。</p>
    <div class="postcard-previews">
      <button v-for="item in PHOTO_POINTS" :key="item.id" type="button" @click="emit('select', item.id)">
        <img v-if="photos[item.id]" :src="photos[item.id]" :alt="`${item.title}的游戏画面`"><span v-else class="photo-placeholder">✳</span>
        <small>{{ item.title }} <span>↗</span></small>
      </button>
    </div>
    <p v-if="PHOTO_POINTS.some(item => !photos[item.id])" class="postcard-note">印记已保存；照片只留在本次游玩中。回到两处重新拍摄即可保存明信片。</p>
    <button type="button" class="postcard-download" :disabled="PHOTO_POINTS.some(item => !photos[item.id]) || downloading" @click="downloadPostcard">保存明信片到本机 <span>↓</span></button>
    <p v-if="downloadError" class="postcard-note" role="status">明信片生成失败，请重试；印记仍在。</p>
    <div class="postcard-actions"><button type="button" @click="emit('close')">继续漫游</button><button type="button" @click="emit('replay')">重新收集</button></div>
    <small class="postcard-privacy">仅在本机生成，不会上传或自动分享。</small>
  </section>
  </div>
  </Teleport>
</template>
