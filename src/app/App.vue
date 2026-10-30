<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import HksOverlay from '../components/HksOverlay.vue';
import PhotoJournal from '../components/PhotoJournal.vue';
import { PHOTO_POINTS, loadPhotoStamps, savePhotoStamps } from '../games/photography';
import { campuses } from '../campus-data/campuses';
import { emptyQuest, startQuest, visitQuest } from '../games/quest';
import { loadProgress, saveProgress } from '../games/storage';
import { createCampusScene } from '../scene/CampusScene';
import type { CampusData, CampusId, CampusSceneHandle, Landmark, SceneEvent } from '../shared/contracts';

type QuestState = ReturnType<typeof emptyQuest>;
type Panel = 'quest' | 'directory' | 'detail';

const campusList = Object.values(campuses) as CampusData[];
// Remember an explicit choice; a first visit opens the polished Yingxi sample.
const CAMPUS_PREFERENCE_KEY = 'campus-atlas:active-campus';
function initialCampus(): CampusId {
  try {
    const saved = window.localStorage.getItem(CAMPUS_PREFERENCE_KEY);
    if (saved === 'huyu' || saved === 'yingxi') return saved;
  } catch { /* Storage is optional. */ }
  return 'yingxi';
}
const campusId = ref<CampusId>(initialCampus());
const campus = computed(() => campusList.find(item => item.id === campusId.value) ?? campusList[0]!);
const progress = ref<Record<CampusId, QuestState>>({ huyu: emptyQuest(), yingxi: emptyQuest() });
try {
  progress.value = loadProgress(campuses);
} catch {
  // Storage is optional; a journey can always be played in memory.
}
const quest = computed(() => progress.value[campusId.value] ?? emptyQuest());
const orderedLandmarks = computed(() => campus.value.questOrder
  .map(id => campus.value.landmarks.find(item => item.id === id))
  .filter((item): item is Landmark => Boolean(item)));
const target = computed(() => quest.value.status === 'active'
  ? orderedLandmarks.value.find(item => !quest.value.visited.includes(item.id)) ?? null
  : null);
const selectedId = ref<string | null>(null);
const selected = computed(() => campus.value.landmarks.find(item => item.id === selectedId.value) ?? null);
const displayed = computed(() => panel.value === 'detail' ? selected.value : target.value);
const displayedFeature = computed(() => campus.value.features.find(item => item.id === displayed.value?.featureId || displayed.value?.featureIds?.includes(item.id)) ?? null);
const visitedNames = computed(() => quest.value.visited.map(id => campus.value.landmarks.find(item => item.id === id)?.name).filter(Boolean));

const hksOpen = ref(false);
function openHks() { hksOpen.value = true; syncScenePause(); }
function focusScene() { nextTick(() => sceneElement.value?.querySelector('canvas')?.focus()); }
function closeHks() { hksOpen.value = false; syncScenePause(); if (!photoCompleteOpen.value) focusScene(); }

const panel = ref<Panel>('quest');
const panelOpen = ref(false);
const arrivedId = ref<string | null>(null);
const answer = ref<number | null>(null);
const travelling = ref(false);
const travelProgress = ref(0);
const notice = ref('');
const sceneError = ref('');
const modelErrors = ref<Record<string, string>>({});
const modelNotice = computed(() => Object.values(modelErrors.value).join(' '));
const sceneElement = ref<HTMLElement | null>(null);
const questButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;
let scene: CampusSceneHandle | null = null;
const photoStamps = ref(loadPhotoStamps());
const photoImages = ref<Record<string, string>>({});
const photoPointId = ref(PHOTO_POINTS.find(point => !photoStamps.value.includes(point.id))?.id ?? PHOTO_POINTS[0]!.id);
const photoPoint = computed(() => PHOTO_POINTS.find(point => point.id === photoPointId.value) ?? PHOTO_POINTS[0]!);
const photoStatus = ref<{ inRange: boolean; framed: boolean; obstructed: boolean; distance: number } | null>(null);
const photoFeedback = ref('');
const photoViewAvailable = ref(true);
const photoModelStatus = ref<'loading' | 'ready' | 'fallback'>('loading');
const photoCompleteOpen = ref(false);
let photoReturnFocus: HTMLElement | null = null;
function syncScenePause() {
  if (hksOpen.value || photoCompleteOpen.value) scene?.pause(); else scene?.resume();
}
function openPhotoComplete() {
  photoReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  photoCompleteOpen.value = true;
  syncScenePause();
}
function closePhotoComplete(restore = true) {
  photoCompleteOpen.value = false;
  syncScenePause();
  if (restore && !hksOpen.value) nextTick(() => {
    if (photoReturnFocus?.isConnected) photoReturnFocus.focus(); else focusScene();
  });
}
const orientationDismissed = ref(false);
const orientationMessage = ref('旋转设备，开启更宽阔的校园视野');
let orientationFullscreen = false;
let orientationLocked = false;
let orientationAttempt = 0;
const orientationBusy = ref(false);
async function tryLandscape() {
  if (orientationBusy.value) return;
  const attempt = ++orientationAttempt;
  orientationBusy.value = true;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      if (attempt !== orientationAttempt || orientationDismissed.value) {
        if (document.fullscreenElement === document.documentElement && document.exitFullscreen) await document.exitFullscreen();
        return;
      }
      orientationFullscreen = true;
    }
    const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
    if (!orientation?.lock) throw new Error('unsupported');
    await orientation.lock('landscape');
    if (attempt !== orientationAttempt || orientationDismissed.value) { orientation.unlock?.(); return; }
    orientationLocked = true;
    orientationMessage.value = '如果画面没有旋转，可手动旋转设备或继续竖屏浏览。';
  } catch {
    if (attempt === orientationAttempt && !orientationDismissed.value) orientationMessage.value = '设备未允许自动横屏，可手动旋转或继续竖屏浏览。';
  } finally { orientationBusy.value = false; }
}
async function dismissOrientation() {
  orientationDismissed.value = true;
  orientationAttempt++;
  if (orientationLocked) {
    try { screen.orientation?.unlock?.(); } catch { /* Not supported on every device. */ }
    orientationLocked = false;
  }
  if (orientationFullscreen && document.fullscreenElement === document.documentElement && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch { /* User can use the browser fullscreen control. */ }
  }
  orientationFullscreen = false;
  focusScene();
}

let photoTimer: number | undefined;
let feedbackTimer: number | undefined;
function updatePhotoStatus() {
  if (campusId.value !== 'yingxi' || hksOpen.value || sceneError.value || !scene) { photoStatus.value = null; return; }
  photoViewAvailable.value = sceneElement.value?.querySelector('canvas')?.dataset.view === 'player';
  photoStatus.value = photoViewAvailable.value ? scene.inspectPhoto(photoPoint.value) : null;
}
function photoMessage(message: string) {
  photoFeedback.value = message;
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => { photoFeedback.value = ''; }, 2800);
}
function recordPhoto() {
  if (campusId.value !== 'yingxi' || hksOpen.value || panelOpen.value || photoCompleteOpen.value || sceneError.value) return;
  if (photoModelStatus.value !== 'ready') { photoMessage(photoModelStatus.value === 'fallback' ? '机械馆细节未能加载，暂无法记录钟楼。' : '机械馆细节正在加载，稍候即可取景。'); return; }
  updatePhotoStatus();
  const status = photoStatus.value;
  if (!status) { photoMessage('请先返回人物视角，再继续取景。'); return; }
  if (!status.inRange) { photoMessage(`还未到观察处，继续靠近 · 约 ${Math.round(status.distance)} 米`); return; }
  if (status.obstructed) { photoMessage('钟楼被景物遮住了，换个位置看看。'); return; }
  if (!status.framed) { photoMessage('调整视角：钟面放进框内，塔顶完整入画。'); return; }
  const image = scene?.capturePhoto();
  if (!image) { photoMessage('未能保存当前画面，请返回人物视角再试。'); return; }
  const id = photoPoint.value.id;
  photoImages.value = { ...photoImages.value, [id]: image };
  if (!photoStamps.value.includes(id)) photoStamps.value = [...photoStamps.value, id];
  savePhotoStamps(photoStamps.value);
  const next = PHOTO_POINTS.find(point => !photoImages.value[point.id]);
  if (next) { photoPointId.value = next.id; photoMessage('已收入手记 · 去寻找下一处风景'); }
  else { openPhotoComplete(); photoFeedback.value = ''; }
  updatePhotoStatus();
}
function selectPhotoPoint(id: string) { photoPointId.value = id; closePhotoComplete(false); photoFeedback.value = ''; updatePhotoStatus(); focusScene(); }
function replayPhotos() { photoStamps.value = []; photoImages.value = {}; savePhotoStamps([]); photoPointId.value = PHOTO_POINTS[0]!.id; closePhotoComplete(false); photoFeedback.value = ''; updatePhotoStatus(); focusScene(); }


function persist() {
  try { saveProgress(progress.value); } catch { /* Continue without storage. */ }
}
function updateQuest(state: QuestState) {
  progress.value = { ...progress.value, [campusId.value]: state };
  persist();
}
function syncScene() {
  scene?.setState({ selectedId: selectedId.value, targetId: target.value?.id ?? null });
}
watch([selectedId, target], syncScene);
function clearJourneyView() {
  arrivedId.value = null;
  answer.value = null;
  travelling.value = false;
  travelProgress.value = 0;
}
function showPanel(view: Panel, trigger?: EventTarget | null) {
  if (trigger instanceof HTMLElement) returnFocus = trigger;
  panel.value = view;
  panelOpen.value = true;
}
function closePanel() {
  panelOpen.value = false;
  nextTick(() => (returnFocus ?? questButton.value)?.focus());
}
function switchCampus(id: CampusId) {
  if (id === campusId.value) return;
  modelErrors.value = {};
  photoModelStatus.value = 'loading';
  scene?.resetJourney();
  clearJourneyView();
  selectedId.value = null;
  campusId.value = id;
  try { window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, id); } catch { /* Keep the in-memory choice. */ }
  panel.value = 'quest';
  panelOpen.value = false;
  notice.value = '已切换校区，两个章节的印记分别保留。返回后可继续前往下一站。';
  try {
    scene?.setCampus(campus.value);
    syncScene();
  } catch {
    sceneError.value = '场景未能载入，可使用无障碍列表模式继续。';
  }
}
function start() {
  scene?.resetJourney();
  clearJourneyView();
  updateQuest(startQuest(campus.value));
  selectedId.value = target.value?.id ?? null;
  panel.value = 'quest';
  panelOpen.value = true;
  notice.value = '旅程开始。自由行走，靠近当前站点后回答问题。';
  syncScene();
}
function replay() { start(); }
function exitQuest() {
  scene?.resetJourney();
  clearJourneyView();
  updateQuest(emptyQuest());
  selectedId.value = null;
  panel.value = 'quest';
  notice.value = '已退出漫游，可以自由浏览或重新开始。';
  syncScene();
}
function selectLandmark(item: Landmark) {
  selectedId.value = item.id;
  panel.value = quest.value.status === 'active' && target.value?.id === item.id ? 'quest' : 'detail';
  panelOpen.value = true;
  if (!sceneError.value) scene?.focusLandmark(item.id);
}
function travel() {
  if (!target.value || travelling.value || sceneError.value) return;
  arrivedId.value = null;
  answer.value = null;
  travelProgress.value = 0;
  travelling.value = true;
  try {
    if (!scene?.navigateTo(target.value.id)) {
      travelling.value = false;
      notice.value = '暂时无法设置本站指引，请重试。';
    } else {
      panelOpen.value = false;
      focusScene();
    }
  } catch {
    travelling.value = false;
    sceneError.value = '场景导航不可用，可使用无障碍列表模式继续。';
  }
}
function accessibleArrival() {
  if (!sceneError.value || !target.value || travelling.value) return;
  arrivedId.value = target.value.id;
  answer.value = null;
  notice.value = '已在无障碍列表模式中打开本站观察题；这不是三维场景到达。';
}
function checkIn() {
  const current = target.value;
  if (!current || arrivedId.value !== current.id || answer.value !== current.answer || travelling.value) return;
  const result = visitQuest(campus.value, quest.value, current.id);
  updateQuest(result.state);
  notice.value = result.message;
  clearJourneyView();
  selectedId.value = target.value?.id ?? null;
  panel.value = 'quest';
  panelOpen.value = true;
  syncScene();
}
function onSceneEvent(event: SceneEvent) {
  if (event.type === 'modelstatus') {
    if (event.id === 'yx-mechanical') photoModelStatus.value = event.status;
    if (event.status === 'fallback') modelErrors.value = { ...modelErrors.value, [event.id]: `${event.name}细节暂未加载；保留基础体块或标记，漫游仍可继续。` };
    else { const next = { ...modelErrors.value }; delete next[event.id]; modelErrors.value = next; }
    return;
  }
  if (event.type === 'error') {
    travelling.value = false;
    sceneError.value = event.reason || '三维场景不可用，可使用无障碍列表模式继续。';
    panelOpen.value = true;
  } else if (event.type === 'select') {
    const item = campus.value.landmarks.find(landmark => landmark.id === event.id || landmark.featureId === event.id);
    if (item) selectLandmark(item);
  } else if (event.type === 'travel') {
    if (travelling.value && Number.isFinite(event.progress)) travelProgress.value = Math.max(0, Math.min(1, event.progress));
  } else if (event.type === 'arrive') {
    if (travelling.value && target.value?.id === event.id) {
      travelling.value = false;
      travelProgress.value = 1;
      arrivedId.value = event.id;
      answer.value = null;
      selectedId.value = event.id;
      panel.value = 'quest';
      panelOpen.value = true;
      notice.value = '已到达本站，看看观察题吧。';
    }
  }
}
function safeUrl(source: string | undefined): string | null {
  if (!source) return null;
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}
function heightLabel(status: string) {
  return status === 'osm-tag' ? 'OSM 标注（非实测保证）' : status === 'level-estimate' ? '按层数估算' : status === 'ml-estimate' ? '2020 年模型预测（非实测）' : '展示用估算，待核实';
}
function onKeydown(event: KeyboardEvent) {
  if (hksOpen.value) return;
  if (event.key === 'Escape' && photoCompleteOpen.value) { event.preventDefault(); closePhotoComplete(); return; }
  if (event.key === 'Escape' && panelOpen.value) closePanel();
  const element = event.target as HTMLElement | null;
  if (event.code === 'KeyE' && !event.repeat && !element?.closest('input, textarea, select, [contenteditable=true]')) { event.preventDefault(); recordPhoto(); }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  photoTimer = window.setInterval(updatePhotoStatus, 250);
  if (!sceneElement.value) return;
  try {
    scene = createCampusScene(sceneElement.value, campus.value, onSceneEvent);
    if (quest.value.status === 'active') {
      selectedId.value = target.value?.id ?? null;
      notice.value = '已恢复旅程进度。请重新前往当前站点。';
    }
    syncScene();
  } catch {
    sceneError.value = '三维场景未能启动，可使用无障碍列表模式继续。';
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.clearInterval(photoTimer); window.clearTimeout(feedbackTimer);
  scene?.dispose();
  scene = null;
});
</script>

<template>
  <div class="app-shell" :inert="hksOpen || photoCompleteOpen" :aria-hidden="hksOpen || photoCompleteOpen ? 'true' : undefined">
    <header class="masthead">
      <div class="brand"><span class="brand-mark" aria-hidden="true">太</span><span>太理 <i>·</i> 时光漫游</span></div>
      <nav class="campus-switch" aria-label="选择校区">
        <button v-for="item in campusList" :key="item.id" type="button" :data-testid="`campus-${item.id}`" :aria-pressed="campusId === item.id" @click="switchCampus(item.id)">{{ item.name }}</button>
      </nav>
      <div class="header-progress" :aria-label="`地标探索已记录 ${quest.visited.length} 站，共 ${orderedLandmarks.length} 站`">
        <span>地标探索</span><span class="header-count">{{ String(quest.visited.length).padStart(2, '0') }} <em>/</em> {{ String(orderedLandmarks.length).padStart(2, '0') }}</span>
        <span class="stamp-dots" aria-hidden="true"><b v-for="item in orderedLandmarks" :key="item.id" :class="{ filled: quest.visited.includes(item.id) }"></b></span>
      </div>
    </header>

    <main class="scene-area" aria-label="校园漫游场景">
      <div ref="sceneElement" class="scene-canvas" aria-label="校园三维场景"></div>
      <div class="scene-shade" aria-hidden="true"></div>
      <div class="chapter-title" :class="{ 'photo-chapter': campusId === 'yingxi' }">
        <span class="eyebrow">CAMPUS CHAPTER <span class="eyebrow-line"></span> {{ campus.id === 'huyu' ? '01' : '02' }}</span>
        <h1>沿着校园，<br>慢慢走</h1>
        <p>{{ campus.name }} <span> / </span> {{ campus.englishName }}</p>
      </div>

      <PhotoJournal v-if="campusId === 'yingxi' && !hksOpen" :point="photoPoint" :stamps="photoStamps" :photos="photoImages" :status="photoStatus" :disabled="!!sceneError" :view-available="photoViewAvailable" :model-status="photoModelStatus" :panel-open="panelOpen" :feedback="photoFeedback" :complete-open="photoCompleteOpen" @record="recordPhoto" @close="closePhotoComplete()" @open="openPhotoComplete" @replay="replayPhotos" @select="selectPhotoPoint" />

      <div v-if="sceneError" class="error-banner" data-testid="scene-error" role="status">
        <strong>无障碍列表模式</strong><span>{{ sceneError }}</span>
        <button type="button" @click="showPanel('quest', $event.currentTarget)">打开旅程</button>
      </div>

      <div class="scene-actions" aria-label="场景工具">
        <button type="button" aria-label="打开校园地图" title="校园地图" :disabled="!!sceneError" @click="scene?.overview()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M8 12h8M12 8v8"/></svg></button>
        <button type="button" aria-label="聚焦当前站点" title="聚焦当前站点" :disabled="!!sceneError || !(target || selected)" @click="(target || selected) && scene?.focusLandmark((target || selected)!.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>
        <button type="button" data-testid="reset-view" aria-label="返回人物视角" title="返回人物视角" :disabled="!!sceneError" @click="scene?.resetView(); focusScene()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2 6M4 4v7h7"/></svg></button>
      </div>
      <div v-if="travelling && target" class="direction-hint">前往 {{ target.name }} <span>·</span> 金线仅指方向，遇建筑请绕行</div>
      <div class="panel-launchers">
        <button type="button" data-testid="open-hks" @click="openHks">古建守护</button>
        <button ref="questButton" type="button" data-testid="open-quest" :aria-expanded="panelOpen && panel === 'quest'" @click="showPanel('quest', $event.currentTarget)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg> 漫游</button>
        <button type="button" data-testid="open-directory" :aria-expanded="panelOpen && panel === 'directory'" @click="showPanel('directory', $event.currentTarget)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg> 地点</button>
      </div>

      <aside v-if="panelOpen" class="floating-panel" :aria-label="panel === 'directory' ? '校园地点目录' : panel === 'detail' ? '地点详情' : '漫游旅程'">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="panel-top">
          <span class="panel-kicker">{{ panel === 'directory' ? 'THE DIRECTORY' : panel === 'detail' ? 'PLACE NOTES' : 'YOUR JOURNEY' }}</span>
          <button type="button" class="icon-button" data-testid="landmark-close" aria-label="关闭面板" @click="closePanel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
        <div class="panel-scroll">
          <template v-if="panel === 'directory'">
            <h2>校园地点</h2><p class="muted">从列表中选择地点，查看它的故事与数据来源。</p>
            <div class="directory-list">
              <button v-for="(item, index) in campus.landmarks" :key="item.id" type="button" :data-testid="`landmark-${item.id}`" :aria-label="`查看 ${item.name} 详情`" @click="selectLandmark(item)">
                <span class="list-index">{{ item.optional ? '•' : String(index + 1).padStart(2, '0') }}</span><span class="list-copy"><strong>{{ item.name }}</strong><small>{{ item.subtitle }}</small></span><span class="arrow" aria-hidden="true">↗</span>
              </button>
            </div>
          </template>
          <template v-else-if="panel === 'quest' && quest.status === 'completed'">
            <div data-testid="completion" class="completion">
              <div class="completion-seal" aria-hidden="true">✳</div><span class="eyebrow">CHAPTER COMPLETE</span>
              <h2>这一章，<br>已收入时光</h2><p class="muted">{{ campus.name }}的漫游已完成，{{ quest.visited.length }} 枚印记已收集。</p>
              <ul class="visited-list"><li v-for="name in visitedNames" :key="name">✳ <span>{{ name }}</span></li></ul>
              <button type="button" class="primary" data-testid="quest-replay" @click="replay">再走一次 <span>↗</span></button>
              <button type="button" class="secondary" @click="switchCampus(campusId === 'huyu' ? 'yingxi' : 'huyu')">探索另一校区</button>
              <button type="button" class="text-button" data-testid="quest-exit" @click="exitQuest">退出漫游</button>
            </div>
          </template>
          <template v-else-if="panel === 'quest' && quest.status === 'idle'">
            <span class="section-number">{{ campus.id === 'huyu' ? '01' : '02' }} / CHAPTER</span><h2>从这里，<br>慢慢认识校园</h2>
            <p class="muted">{{ campus.description }}</p><div class="fine-rule"></div>
            <p class="intro-note">跟随线索走访 {{ orderedLandmarks.length }} 个地点，观察、回答，再收集属于这一章的印记。</p>
            <div class="help-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 6v4"/></svg><span>WASD 行走 · 鼠标拖动视角<br><small>Shift 跑步 · 空格跳跃；触屏左移右看</small></span></div>
            <button type="button" class="primary" data-testid="quest-start" @click="start">开始漫游 <span>↗</span></button>
          </template>
          <template v-else-if="displayed">
            <div class="detail-heading"><span class="section-number">{{ panel === 'quest' ? `STOP ${String(quest.visited.length + 1).padStart(2, '0')} / ${String(orderedLandmarks.length).padStart(2, '0')}` : 'CAMPUS PLACE' }}</span><span v-if="quest.visited.includes(displayed.id)" class="recorded">已记录 ✳</span></div>
            <h2>{{ displayed.name }}</h2><p class="subtitle">{{ displayed.subtitle }}</p>
            <p class="facts">{{ displayed.facts }}</p>
            <div v-if="displayedFeature" class="metric-note">轮廓：米制坐标 · 高 {{ displayedFeature.height }} m（{{ heightLabel(displayedFeature.heightStatus) }}）<template v-if="displayedFeature.levels !== null"> · {{ displayedFeature.levels }} 层</template></div>
            <div class="source-note">地点来源：<a v-if="safeUrl(displayed.source)" :href="safeUrl(displayed.source)!" target="_blank" rel="noopener noreferrer">{{ displayed.source }}</a><span v-else>{{ displayed.source }}</span><template v-if="displayedFeature"><br>轮廓来源：<a v-if="safeUrl(displayedFeature.source)" :href="safeUrl(displayedFeature.source)!" target="_blank" rel="noopener noreferrer">{{ displayedFeature.source }}</a><span v-else>{{ displayedFeature.source }}</span></template></div>
            <p v-if="displayedFeature?.heightSource" class="facts">楼高依据：{{ displayedFeature.heightSource.dataset }}<template v-if="displayedFeature.heightSource.year"> · {{ displayedFeature.heightSource.year }}</template><template v-if="displayedFeature.heightSource.matchIoU !== undefined"> · 轮廓重叠 {{ Math.round(displayedFeature.heightSource.matchIoU * 100) }}%</template>。<a v-if="safeUrl(displayedFeature.heightSource.source)" :href="safeUrl(displayedFeature.heightSource.source)!" target="_blank" rel="noopener noreferrer">查看高度来源</a></p>
            <p v-if="safeUrl(displayed.visualSource)" class="facts"><a :href="safeUrl(displayed.visualSource)!" target="_blank" rel="noopener noreferrer">建筑外观参考来源</a></p>
            <template v-if="panel === 'quest' && target?.id === displayed.id">
              <div class="clue"><span>观察线索</span><p>{{ displayed.clue }}</p></div>
              <div data-testid="arrival-status" class="arrival-status" aria-live="polite">{{ arrivedId === displayed.id ? (sceneError ? '无障碍列表模式 · 已打开观察题' : '已到达 · 可以开始观察') : travelling ? '金线仅指方向，遇建筑请绕行' : '尚未到达本站' }}</div>
              <template v-if="arrivedId !== displayed.id">
                <button v-if="!sceneError" type="button" class="primary" data-testid="quest-travel" :disabled="travelling" @click="travel">{{ travelling ? '指引已开启' : '开启方向指引' }} <span>↗</span></button>
                <button v-else type="button" class="primary" data-testid="quest-travel" @click="accessibleArrival">列表模式：打开观察题 <span>↗</span></button>
              </template>
              <div v-else class="question">
                <p class="question-title">{{ displayed.question }}</p>
                <div class="choices" role="group" :aria-label="displayed.question">
                  <button v-for="(choice, index) in displayed.choices" :key="index" type="button" :data-testid="`answer-${index}`" :aria-pressed="answer === index" :class="{ chosen: answer === index, correct: answer === index && answer === displayed.answer, wrong: answer === index && answer !== displayed.answer }" @click="answer = index"><span>{{ String.fromCharCode(65 + index) }}</span>{{ choice }}</button>
                </div>
                <p v-if="answer !== null" class="answer-feedback" aria-live="polite">{{ answer === displayed.answer ? '答对了，可以记录这一站。' : '再观察一下，换个答案试试。' }}</p>
                <button type="button" class="primary" data-testid="quest-check-in" :disabled="answer !== displayed.answer" @click="checkIn">记录这一站 <span>✳</span></button>
              </div>
              <button type="button" class="text-button" data-testid="quest-exit" @click="exitQuest">退出漫游</button>
            </template>
            <template v-else>
              <p v-if="quest.status === 'active'" class="order-note">当前旅程请先完成「{{ target?.name }}」。</p>
              <button type="button" class="secondary" @click="showPanel('quest', $event.currentTarget)">返回旅程</button>
              <button type="button" class="text-button" @click="showPanel('directory', $event.currentTarget)">查看全部地点</button>
            </template>
          </template>
        </div>
      </aside>

      <p v-if="modelNotice" class="model-note" role="status" data-testid="model-notice">{{ modelNotice }}</p>
      <div class="attribution">{{ campus.attribution }} <span>·</span> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> <span>·</span> 米制轮廓 · 楼高含估算 <span>·</span> <a href="./data/sources/README.md" target="_blank" rel="noopener noreferrer">数据来源与许可</a></div>
    </main>

    <footer class="journey-bar" data-testid="quest-status">
      <div class="bar-label"><span class="bar-icon" aria-hidden="true">✳</span><div><small>YOUR JOURNEY</small><strong>{{ travelling ? '自由前往目的地' : quest.status === 'completed' ? '本章已完成' : quest.status === 'active' ? (target?.name ?? '旅程进行中') : '准备出发' }}</strong></div></div>
      <div class="bar-route" :aria-label="`已记录 ${quest.visited.length} / ${orderedLandmarks.length} 站`"><template v-for="(item, index) in orderedLandmarks" :key="item.id"><span v-if="index > 0" class="route-line"></span><span class="route-stop" :class="{ done: quest.visited.includes(item.id), current: target?.id === item.id }" :title="item.name">{{ quest.visited.includes(item.id) ? '✳' : String(index + 1).padStart(2, '0') }}</span></template></div>
      <div class="bar-end"><span>{{ quest.status === 'active' ? '下一站' : '漫游进度' }}</span><strong>{{ quest.visited.length }} <i>/</i> {{ orderedLandmarks.length }}</strong></div>
    </footer>
    <div class="control-caption" aria-hidden="true"><b>W A S D</b> 行走 <span>·</span> 拖动视角 <span>·</span> Shift 跑步 <span>·</span> Space 跳跃</div>
    <div class="sr-only" aria-live="polite">{{ notice }}</div>
  </div>
  <div v-if="!orientationDismissed && !photoCompleteOpen && !hksOpen" class="orientation-prompt" role="status" data-testid="orientation-prompt">
    <svg class="orientation-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="13" width="20" height="34" rx="3" transform="rotate(-18 32 30)"/><path d="M47 17a22 22 0 0 1 6 20M53 37l4-6M53 37l-7-2M17 47a22 22 0 0 1-6-20M11 27l-4 6M11 27l7 2"/></svg><strong>建议横屏漫游</strong><small>{{ orientationMessage }}</small>
    <button type="button" data-testid="orientation-fullscreen" :disabled="orientationBusy" @click="tryLandscape">尝试全屏横屏</button>
    <button type="button" data-testid="orientation-dismiss" @click="dismissOrientation">继续竖屏浏览</button>
  </div>
  <HksOverlay v-if="hksOpen" @close="closeHks" />
</template>
