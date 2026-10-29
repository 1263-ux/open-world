<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { createCampusScene } from '../scene/CampusScene';
import { campuses } from '../campus-data/campuses';
import type { CampusId, CampusSceneHandle, Landmark, SceneEvent } from '../shared/contracts';
import { emptyQuest, startQuest, visitQuest, type QuestState } from '../games/quest';
import { loadProgress, saveProgress, type QuestProgress } from '../games/storage';

const campusId = ref<CampusId>('huyu');
const progress = ref<QuestProgress>({ huyu: emptyQuest(), yingxi: emptyQuest() });
const selectedId = ref<string | null>(null);
const sceneElement = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const sceneError = ref('');
const announcement = ref('');
const storageNotice = ref('');
let scene: CampusSceneHandle | null = null;
let returnFocus: HTMLElement | null = null;
let mounted = false;

const campus = computed(() => campuses[campusId.value]);
const quest = computed(() => progress.value[campusId.value]);
const selected = computed(() => campus.value.landmarks.find((item) => item.id === selectedId.value) ?? null);
const targetId = computed(() => quest.value.status === 'active' ? campus.value.questOrder[quest.value.visited.length] ?? null : null);
const target = computed(() => campus.value.landmarks.find((item) => item.id === targetId.value) ?? null);
const questLabel = computed(() => {
  if (quest.value.status === 'completed') return '探索完成';
  if (quest.value.status === 'active') return '探索进行中';
  return '尚未开始';
});

function announce(message: string) {
  announcement.value = '';
  void nextTick(() => { announcement.value = message; });
}

function syncScene() {
  try {
    scene?.setState({ selectedId: selectedId.value, targetId: targetId.value });
  } catch {
    handleSceneFailure('场景更新失败');
  }
}

function handleSceneFailure(reason: string) {
  sceneError.value = reason || '无法初始化三维场景';
  announce('三维场景不可用，仍可通过地标列表探索和完成任务。');
}

function sceneEvent(event: SceneEvent) {
  if (event.type === 'error') {
    handleSceneFailure(event.reason);
    return;
  }
  const landmark = campus.value.landmarks.find((item) => item.id === event.id);
  if (landmark) selectLandmark(landmark, null);
}

function landmarkButton(id: string): HTMLElement | null {
  return document.getElementById(`landmark-${id}`);
}

function selectLandmark(landmark: Landmark, origin: EventTarget | null) {
  returnFocus = origin instanceof HTMLElement ? origin : landmarkButton(landmark.id);
  selectedId.value = landmark.id;
  syncScene();
  announce(`已选择${landmark.name}。`);
  void nextTick(() => closeButton.value?.focus());
}

function closeCard(restoreFocus = true) {
  selectedId.value = null;
  syncScene();
  const focus = returnFocus;
  returnFocus = null;
  if (restoreFocus) void nextTick(() => focus?.isConnected && focus.focus());
}

function updateQuest(state: QuestState) {
  progress.value = { ...progress.value, [campusId.value]: state };
  if (mounted && !saveProgress(progress.value)) storageNotice.value = '无法保存进度；本次浏览仍可继续。';
  else storageNotice.value = '';
  syncScene();
}

function switchCampus(id: CampusId) {
  if (id === campusId.value) return;
  const cancelled = quest.value.status === 'active';
  if (cancelled) updateQuest(emptyQuest());
  closeCard(false);
  campusId.value = id;
  try {
    scene?.setCampus(campus.value);
    syncScene();
  } catch {
    handleSceneFailure('切换三维场景失败');
  }
  announce(`已切换至${campus.value.name}。${cancelled ? '原校区的进行中任务已取消。' : ''}`);
}

function beginQuest() {
  updateQuest(startQuest(campus.value));
  announce('探索任务已开始，请按顺序记录地标。');
}

function checkIn() {
  if (!selected.value) return;
  const result = visitQuest(campus.value, quest.value, selected.value.id);
  if (result.state !== quest.value) updateQuest(result.state);
  announce(result.message);
}

function replayQuest() {
  updateQuest(startQuest(campus.value));
  announce('已清空本校区的任务记录，重新开始探索。');
}

function exitQuest() {
  updateQuest(emptyQuest());
  announce('已退出任务，本次任务记录已清空。');
}

function resetView() {
  if (!scene) {
    announce('三维场景不可用，无法重置视角。');
    return;
  }
  try {
    scene.resetView();
    announce('视角已重置。');
  } catch {
    handleSceneFailure('重置视角失败');
  }
}

onMounted(() => {
  progress.value = loadProgress(campuses);
  mounted = true;
  if (!sceneElement.value) {
    handleSceneFailure('找不到场景容器');
    return;
  }
  try {
    scene = createCampusScene(sceneElement.value, campus.value, sceneEvent);
    syncScene();
  } catch {
    handleSceneFailure('无法初始化三维场景');
  }
});

onBeforeUnmount(() => {
  mounted = false;
  try { scene?.dispose(); } catch { /* Best-effort cleanup during unmount. */ }
  scene = null;
});
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#landmark-list">跳到地标列表</a>
    <header class="masthead">
      <div class="brand" aria-label="太理校园漫游">
        <span class="brand-mark" aria-hidden="true">T<span>·</span></span>
        <div><strong>太理 · 校园漫游</strong><small>CAMPUS ATLAS</small></div>
      </div>
      <div class="masthead-right">
        <span class="masthead-note">一份关于校园的空间手记</span>
        <div class="campus-switch" role="group" aria-label="选择校区">
          <button type="button" data-testid="campus-huyu" :aria-pressed="campusId === 'huyu'" @click="switchCampus('huyu')">虎峪</button>
          <button type="button" data-testid="campus-yingxi" :aria-pressed="campusId === 'yingxi'" @click="switchCampus('yingxi')">迎西</button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <div class="page-heading">
        <div><span class="eyebrow">CAMPUS EXPLORER <span class="eyebrow-line"></span> 01 / 02</span><h1>从这里，<em>认识校园。</em></h1></div>
        <p>用自己的步调，走近校园里的每一个坐标。</p>
      </div>

      <div class="explorer">
        <aside class="intro-panel" aria-labelledby="campus-heading">
          <div class="section-kicker"><span>THE CAMPUS</span><span>↗</span></div>
          <div class="campus-intro">
            <span class="campus-index">{{ campusId === 'huyu' ? '01' : '02' }} / CAMPUS</span>
            <h2 id="campus-heading">{{ campus.name }}</h2>
            <p class="english-name">{{ campus.englishName }}</p>
            <p class="intro-copy">{{ campus.description }}</p>
          </div>
          <div class="list-heading" id="landmark-list" tabindex="-1"><span>地标目录</span><span>{{ String(campus.landmarks.length).padStart(2, '0') }} PLACES</span></div>
          <nav class="landmark-list" aria-label="地标列表">
            <button v-for="(landmark, index) in campus.landmarks" :id="`landmark-${landmark.id}`" :key="landmark.id" type="button" class="landmark-row" :class="{ 'is-selected': selectedId === landmark.id }" :data-testid="`landmark-${landmark.id}`" :aria-label="`查看${landmark.name}`" :aria-pressed="selectedId === landmark.id" @click="selectLandmark(landmark, $event.currentTarget)">
              <span class="row-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="row-copy"><strong>{{ landmark.name }}</strong><small>{{ landmark.subtitle }}</small></span>
              <span class="row-arrow" aria-hidden="true">↗</span>
            </button>
          </nav>
          <p class="panel-footnote">选择地标，展开它的校园故事。</p>
        </aside>

        <section class="scene-panel" aria-label="校园三维示意场景">
          <div class="scene-topline"><span>AN IMPRESSION OF CAMPUS</span><span class="scene-coordinate">{{ campus.englishName }} / SCHEMATIC</span></div>
          <div class="scene-wrap">
            <div ref="sceneElement" class="scene-host" aria-label="校园三维场景，可通过地标列表访问相同内容"></div>
            <div class="schematic-badge"><span aria-hidden="true">✳</span> 空间与建筑为示意，非精确导航</div>
            <div v-if="sceneError" class="scene-error" data-testid="scene-error" role="status">
              <strong>三维场景暂不可用</strong><span>{{ sceneError }}。请使用地标列表继续探索和记录任务。</span>
            </div>
            <article v-if="selected" class="landmark-card" aria-labelledby="card-title">
              <div class="card-top"><span>PLACE / 校园地标</span><button ref="closeButton" type="button" class="icon-button" data-testid="landmark-close" aria-label="关闭地标详情" @click="closeCard()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg></button></div>
              <h3 id="card-title">{{ selected.name }}</h3>
              <p class="card-subtitle">{{ selected.subtitle }}</p>
              <p class="card-facts">{{ selected.facts }}</p>
              <p class="card-disclaimer">示意模型 · 外观与尺寸待核验</p>
              <a class="source-link" :href="selected.source" target="_blank" rel="noopener noreferrer">查看资料来源 <span aria-hidden="true">↗</span><span class="sr-only">（在新窗口打开）</span></a>
              <button v-if="quest.status === 'active'" type="button" class="primary-button card-action" data-testid="quest-check-in" @click="checkIn">记录这一站 <span aria-hidden="true">↗</span></button>
            </article>
          </div>
          <div class="scene-toolbar">
            <div class="toolbar-scale" aria-label="场景为示意，不提供比例尺"><span class="scale-mark" aria-hidden="true"></span><span>示意场景 · 非比例尺</span></div>
            <div class="toolbar-actions"><span class="north-mark" aria-label="北方标记">N <span aria-hidden="true">↑</span></span><button type="button" data-testid="reset-view" :disabled="!!sceneError" aria-label="重置场景视角" @click="resetView"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2 6M4 5v6h6" /></svg>重置视角</button></div>
          </div>
        </section>

        <aside class="quest-panel" aria-labelledby="quest-heading">
          <div class="section-kicker"><span>THE JOURNEY</span><span>✳</span></div>
          <div class="quest-intro"><span class="quest-number">FIELD NOTES / 01</span><h2 id="quest-heading">校园探索<br><em>小任务</em></h2><p>沿着地标线索，收集一段属于你的校园印象。</p></div>
          <div class="quest-progress">
            <div class="progress-heading"><span data-testid="quest-status">{{ questLabel }}</span><span>{{ String(quest.visited.length).padStart(2, '0') }} / {{ String(campus.questOrder.length).padStart(2, '0') }}</span></div>
            <div class="progress-track" aria-hidden="true"><span :style="{ width: `${campus.questOrder.length ? quest.visited.length / campus.questOrder.length * 100 : 0}%` }"></span></div>
            <ol class="quest-steps">
              <li v-for="(id, index) in campus.questOrder" :key="id" :class="{ done: quest.visited.includes(id), current: targetId === id }">
                <span class="step-dot" aria-hidden="true">{{ quest.visited.includes(id) ? '✓' : String(index + 1).padStart(2, '0') }}</span>
                <span>{{ campus.landmarks.find((item) => item.id === id)?.name ?? id }}</span>
                <small>{{ quest.visited.includes(id) ? '已记录' : targetId === id ? '下一站' : '待探索' }}</small>
              </li>
            </ol>
          </div>
          <p v-if="quest.status === 'active'" class="quest-hint">打开{{ target?.name ?? '下一站' }}的详情，选择“记录这一站”。</p>
          <p v-else-if="quest.status === 'completed'" class="quest-hint">这一程已完成。你可以重新出发。</p>
          <div class="quest-actions">
            <button v-if="quest.status === 'idle'" type="button" class="primary-button" data-testid="quest-start" @click="beginQuest">开始探索 <span aria-hidden="true">↗</span></button>
            <button v-if="quest.status === 'completed'" type="button" class="primary-button" data-testid="quest-replay" @click="replayQuest">重新探索 <span aria-hidden="true">↗</span></button>
            <button v-if="quest.status === 'active'" type="button" class="text-button" data-testid="quest-exit" @click="exitQuest">退出任务</button>
          </div>
          <p v-if="storageNotice" class="storage-notice">{{ storageNotice }}</p>
        </aside>
      </div>
      <footer class="page-footer"><span>TAIYUAN UNIVERSITY OF TECHNOLOGY</span><span>一段校园，一种印象。 / CAMPUS ATLAS</span></footer>
    </main>
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
  </div>
</template>
