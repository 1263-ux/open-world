<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CampusMinimap from '../components/CampusMinimap.vue';
import HksOverlay from '../components/HksOverlay.vue';
import PhotoJournal from '../components/PhotoJournal.vue';
import JourneyPanel from '../components/JourneyPanel.vue';
import PaperplanePanel from '../components/PaperplanePanel.vue';
import { createJourney, recordJourneyPhoto, recordJourneyFlight, journeyStage } from '../games/journey';
import { loadJourney, saveJourney } from '../games/journey-storage';
import { PHOTO_POINTS, loadPhotoStamps, savePhotoStamps } from '../games/photography';
import { campuses } from '../campus-data/campuses';
import type { RenderQualityMode, RenderQualityState } from '../scene/AdaptiveRenderQuality';
import { CAMPUS_STORIES } from '../campus-data/stories';
import { emptyQuest, startQuest, visitQuest } from '../games/quest';
import { loadProgress, saveProgress } from '../games/storage';
import { createCampusScene } from '../scene/CampusScene';
import type { IdealActivityInspection, CampusMode, CampusData, CampusId, CampusSceneHandle, Landmark, SceneEvent, PaperplaneSnapshot, PaperplaneInput, PhotoInspection } from '../shared/contracts';

const QUALITY_KEY = 'campus-atlas:render-quality:v1';
function initialQuality(): RenderQualityMode {
  try { const value = localStorage.getItem(QUALITY_KEY); return value === 'clear' || value === 'smooth' ? value : 'auto'; }
  catch { return 'auto'; }
}
const qualityMode = ref<RenderQualityMode>(initialQuality());
const qualityState = ref<RenderQualityState | null>(null);
function chooseQuality(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value !== 'auto' && value !== 'clear' && value !== 'smooth') return;
  qualityMode.value = value;
  qualityState.value = scene?.setRenderQuality(value) ?? null;
  try { localStorage.setItem(QUALITY_KEY, value); } catch { /* Optional independent preference, never journey data. */ }
}
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
const CAMPUS_MODE_KEY = 'campus-atlas:campus-mode:v1';
function initialCampusMode(): CampusMode {
  try { return window.localStorage.getItem(CAMPUS_MODE_KEY) === 'ideal' ? 'ideal' : 'base'; }
  catch { return 'base'; }
}
const preferredCampusMode = ref<CampusMode>(initialCampusMode());
const campusMode = ref<CampusMode>('base');
const campusModeFeedback = ref('');
function restoreCampusMode() {
  if (!scene) return;
  const result = scene.requestCampusMode(preferredCampusMode.value);
  campusMode.value = result.mode;
  if (!result.applied) campusModeFeedback.value = result.reason;
}
function toggleCampusMode() {
  if (!scene || sceneError.value) { campusModeFeedback.value = '三维场景不可用，无法切换设施。'; return; }
  if (mode.value !== 'exploring' || panelOpen.value || notebookConfirming.value) {
    campusModeFeedback.value = '请先退出当前活动或面板，回到自由步行后切换。'; return;
  }
  const result = scene.requestCampusMode(campusMode.value === 'base' ? 'ideal' : 'base');
  campusMode.value = result.mode; campusModeFeedback.value = result.reason;
  updateIdealActivity();
  if (result.applied) {
    preferredCampusMode.value = result.mode;
    try { window.localStorage.setItem(CAMPUS_MODE_KEY, result.mode); } catch { /* Keep the in-memory preference; journey storage is untouched. */ }
  }
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
const displayedStory = computed(() => displayed.value ? CAMPUS_STORIES[displayed.value.id] : undefined);
const displayedFeature = computed(() => campus.value.features.find(item => item.id === displayed.value?.featureId || displayed.value?.featureIds?.includes(item.id)) ?? null);
const visitedNames = computed(() => quest.value.visited.map(id => campus.value.landmarks.find(item => item.id === id)?.name).filter(Boolean));

type ActivityMode = 'reading'|'exploring'|'photo'|'planeReady'|'flying'|'planeResult'|'hks'|'paused';
const mode = ref<ActivityMode>('exploring');
const idealActivity = ref<IdealActivityInspection | null>(null);
const readingOpen = computed(() => mode.value === 'reading');
const readingDialog = ref<HTMLElement | null>(null);
const readingCloseButton = ref<HTMLButtonElement | null>(null);
let readingReturnFocus: HTMLElement | null = null;
function updateIdealActivity() {
  idealActivity.value = mode.value === 'exploring' && !panelOpen.value && !notebookConfirming.value && !sceneError.value ? scene?.inspectIdealActivity() ?? null : null;
}
function openIdealActivity() {
  updateIdealActivity(); // Reject stale prompts after walking away or opening another activity.
  if (!idealActivity.value?.available) return;
  if (idealActivity.value.kind === 'photos') { openPhotoComplete(); return; }
  readingReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  mode.value = 'reading'; idealActivity.value = null;
  syncScenePause();
  nextTick(() => readingCloseButton.value?.focus());
}
function closeReading() {
  if (!readingOpen.value) return;
  mode.value = 'exploring'; syncScenePause(); updateIdealActivity();
  nextTick(() => { if (readingReturnFocus?.isConnected) readingReturnFocus.focus(); else focusScene(); });
}
function trapReadingFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !readingDialog.value) return;
  const items = Array.from(readingDialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'));
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (!items.length) { event.preventDefault(); return; }
  if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1]?.focus(); }
  else if (!event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0]?.focus(); }
}
const planeSnapshot = ref<PaperplaneSnapshot | null>(null);
const planeActive = computed(() => planeSnapshot.value !== null);
const hksOpen = computed(() => mode.value === 'hks');
const journey = ref(loadJourney());
const planeNearby = ref(false);
const notebookHidden = ref(false);
const notebookExpanded = ref(false);
const notebookConfirming = ref(false);
const journeySaved = ref(true);
const showNotebook = computed(() => !notebookHidden.value && (notebookExpanded.value || !journey.value || ['flight','complete'].includes(journeyStage(journey.value))));
function persistJourney() { if (journey.value) journeySaved.value = saveJourney(journey.value); }
function startNotebook() { notebookExpanded.value = false; notebookHidden.value = false; journey.value = createJourney(); persistJourney(); focusScene(); }
function restartNotebook() {
  startNotebook(); photoImages.value = {}; photoPointId.value = 'hall';
}
function confirmNotebook(open: boolean) { notebookConfirming.value = open; syncScenePause(); }
function openNotebook() { notebookHidden.value = false; notebookExpanded.value = true; }
function continueNotebook() { notebookExpanded.value = false; notebookHidden.value = false; focusScene(); }
function freeRoam() { notebookExpanded.value = false; notebookHidden.value = true; focusScene(); }
function resumeFlight() { scene?.resumePaperplane(); focusScene(); }
function launchFlight() { scene?.launchPaperplane(); focusScene(); }
function openHks() { if (mode.value !== 'exploring' || notebookConfirming.value) return; mode.value = 'hks'; syncScenePause(); }
function focusScene() { nextTick(() => sceneElement.value?.querySelector('canvas')?.focus()); }
function closeHks() { mode.value = 'exploring'; syncScenePause(); if (!photoCompleteOpen.value) focusScene(); }

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
const mapOpen = ref(false);
const playerPosition = ref<[number, number] | null>(null);
function syncMinimap() {
  if (hksOpen.value || photoCompleteOpen.value || document.hidden) return;
  const canvas = sceneElement.value?.querySelector('canvas');
  if (!canvas) return;
  mapOpen.value = canvas.dataset.view === 'map';
  const x = Number(canvas.dataset.playerX), z = Number(canvas.dataset.playerZ);
  if (canvas.dataset.playerX !== undefined && canvas.dataset.playerZ !== undefined && Number.isFinite(x) && Number.isFinite(z) && (playerPosition.value?.[0] !== x || playerPosition.value?.[1] !== z)) playerPosition.value = [x, z];
}
// Optional arrival guidance is session-only; it never creates or completes a quest.
const arrivalGuidanceId = ref<string | null>(null);
const currentObjective = computed(() => target.value ?? campus.value.landmarks.find(item => item.id === (arrivalGuidanceId.value ?? (campusId.value === 'huyu' ? 'hy-north-gate' : 'yx-mechanical'))) ?? null);
const objectiveDistance = computed(() => currentObjective.value && playerPosition.value ? Math.hypot(currentObjective.value.arrival[0] - playerPosition.value[0], currentObjective.value.arrival[1] - playerPosition.value[1]) : null);
const objectiveNearby = computed(() => objectiveDistance.value !== null && objectiveDistance.value < 5);
const objectiveDirection = computed(() => {
  if (!currentObjective.value || !playerPosition.value) return '';
  const dx = currentObjective.value.arrival[0] - playerPosition.value[0], dz = currentObjective.value.arrival[1] - playerPosition.value[1];
  return Math.abs(dx) > Math.abs(dz) * 1.5 ? dx > 0 ? '向东' : '向西' : Math.abs(dz) > Math.abs(dx) * 1.5 ? dz > 0 ? '向南' : '向北' : `${dz > 0 ? '向南' : '向北'}${dx > 0 ? '东' : '西'}`;
});
const idealPromptVisible = computed(() => (campusId.value !== 'yingxi' || !notebookExpanded.value) && !!idealActivity.value && idealActivity.value.distance <= 8 && mode.value === 'exploring' && !panelOpen.value && !mapOpen.value && !notebookConfirming.value);
const showCompactObjective = computed(() => mode.value === 'exploring' && !panelOpen.value && !mapOpen.value && !notebookConfirming.value && !idealPromptVisible.value && (campusId.value === 'huyu' || (!journey.value && showNotebook.value && !notebookExpanded.value)));
function openObjectiveStory(trigger: EventTarget | null) {
  if (!currentObjective.value || mode.value !== 'exploring') return;
  selectedId.value = currentObjective.value.id;
  showPanel('detail', trigger); // Read in place: do not fly the camera to a map view.
}
function continueIntoCampus() {
  if (campusId.value !== 'huyu' || quest.value.status === 'active' || mode.value !== 'exploring' || panelOpen.value || mapOpen.value || !objectiveNearby.value || currentObjective.value?.id !== 'hy-north-gate') return;
  if (!scene?.navigateTo('hy-meihua')) { notice.value = '暂时无法设置指引，请稍后重试。'; return; }
  arrivalGuidanceId.value = 'hy-meihua';
  notice.value = '已显示去梅花教室的原路线。沿铺装向校内走，在前场转向西侧；这是可选指引，不会开始或改写任务。';
  focusScene();
}
function toggleOverview() {
  if (!scene || sceneError.value || planeActive.value) return;
  if (mapOpen.value) { scene.resetView(); focusScene(); } else scene.overview();
  syncMinimap();
}
const questButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;
let scene: CampusSceneHandle | null = null;
const photoStamps = ref(loadPhotoStamps());
const photoImages = ref<Record<string, string>>({});
const photoPointId = ref(PHOTO_POINTS.find(point => !journey.value?.photos.includes(point.id as 'hall'|'garden'|'platform'))?.id ?? PHOTO_POINTS[0]!.id);
const photoPoint = computed(() => PHOTO_POINTS.find(point => point.id === photoPointId.value) ?? PHOTO_POINTS[0]!);
const photoStatus = ref<PhotoInspection | null>(null);
const photoFeedback = ref('');
const photoViewAvailable = ref(true);
type PhotoModelStatus = 'loading' | 'ready' | 'fallback';
const photoModelStatuses = ref<Record<string, PhotoModelStatus>>({});
const photoModelStatus = computed(() => photoModelStatuses.value[photoPoint.value.landmarkId] ?? 'loading');
const photoCompleteOpen = computed(() => mode.value === 'photo');
let photoReturnFocus: HTMLElement | null = null;
function syncScenePause() {
  if (hksOpen.value || photoCompleteOpen.value || readingOpen.value || notebookConfirming.value) scene?.pause(); else scene?.resume();
}
function openPhotoComplete() {
  photoReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (mode.value !== 'exploring') return;
  mode.value = 'photo'; idealActivity.value = null;
  syncScenePause();
}
function closePhotoComplete(restore = true) {
  if (mode.value === 'photo') mode.value = 'exploring';
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
  if (campusId.value !== 'yingxi' || mode.value !== 'exploring' || sceneError.value || !scene) { photoStatus.value = null; return; }
  photoViewAvailable.value = sceneElement.value?.querySelector('canvas')?.dataset.view === 'player';
  if (!photoViewAvailable.value) { photoStatus.value = null; return; }
  // Free exploration: if an unphotographed station is reached first, offer it
  // without moving the player or skipping a missing model's readiness gate.
  if (!panelOpen.value && !photoCompleteOpen.value) {
    const nearby = PHOTO_POINTS.find(point => point.id !== photoPointId.value && !journey.value?.photos.includes(point.id as 'hall'|'garden'|'platform') && scene!.inspectPhoto(point).inRange);
    if (nearby) { photoPointId.value = nearby.id; photoFeedback.value = ''; }
  }
  photoStatus.value = scene.inspectPhoto(photoPoint.value);
}
function photoMessage(message: string) {
  photoFeedback.value = message;
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => { photoFeedback.value = ''; }, 2800);
}
function recordPhoto() {
  if (campusId.value !== 'yingxi' || notebookConfirming.value || mode.value !== 'exploring' || panelOpen.value || photoCompleteOpen.value || sceneError.value) return;
  updatePhotoStatus();
  if (photoModelStatus.value !== 'ready') { photoMessage(photoModelStatus.value === 'fallback' ? `${photoPoint.value.modelLabel}未能加载，暂无法记录${photoPoint.value.subject}。` : `${photoPoint.value.modelLabel}正在加载，稍候即可取景。`); return; }
  const status = photoStatus.value;
  if (!status) { photoMessage('请先返回人物视角，再继续取景。'); return; }
  if (!status.inRange) { photoMessage(`还未到观察处，继续靠近 · 约 ${Math.round(status.distance)} 米`); return; }
  if (status.settling) { photoMessage('稍候片刻，让镜头稳定后再记录。'); return; }
  if (status.obstructed) { photoMessage(`${photoPoint.value.subject}被景物遮住了，换个位置看看。`); return; }
  if (!status.framed) { photoMessage(`${photoPoint.value.frameHint}。`); return; }
  const image = scene?.capturePhoto();
  if (!image) { photoMessage('未能保存当前画面，请返回人物视角再试。'); return; }
  const id = photoPoint.value.id;
  photoImages.value = { ...photoImages.value, [id]: image };
  if (!photoStamps.value.includes(id)) photoStamps.value = [...photoStamps.value, id];
  savePhotoStamps(photoStamps.value);
  journey.value = recordJourneyPhoto(journey.value ?? createJourney(), id); notebookHidden.value = false; persistJourney();
  const next = PHOTO_POINTS.find(point => !journey.value?.photos.includes(point.id as 'hall'|'garden'|'platform'));
  if (next) { photoPointId.value = next.id; photoMessage('已收入手记 · 去寻找下一处风景'); }
  else { photoMessage('三处风景已记录 · 沿台阶下行，到旁边的纸飞机站完成航线'); }
  updatePhotoStatus();
}
function selectPhotoPoint(id: string) { notebookHidden.value = true; notebookExpanded.value = false; photoPointId.value = id; closePhotoComplete(false); photoFeedback.value = ''; updatePhotoStatus(); focusScene(); }
function replayPhotos() { closePhotoComplete(false); restartNotebook(); updatePhotoStatus(); }


function persist() {
  try { saveProgress(progress.value); } catch { /* Continue without storage. */ }
}
function updateQuest(state: QuestState) {
  progress.value = { ...progress.value, [campusId.value]: state };
  persist();
}
function syncScene() {
  scene?.setState({ selectedId: selectedId.value, targetId: target.value?.id ?? arrivalGuidanceId.value });
}
watch([selectedId, target, arrivalGuidanceId], syncScene);
function clearJourneyView() {
  arrivalGuidanceId.value = null;
  arrivedId.value = null;
  answer.value = null;
  travelling.value = false;
  travelProgress.value = 0;
}
function showPanel(view: Panel, trigger?: EventTarget | null) {
  if (mode.value !== 'exploring') return;
  if (trigger instanceof HTMLElement) returnFocus = trigger;
  panel.value = view;
  panelOpen.value = true;
}
function closePanel() {
  panelOpen.value = false;
  nextTick(() => {
    if (returnFocus?.isConnected) returnFocus.focus();
    else {
      const id = returnFocus?.dataset.testid;
      const restored = id === 'objective-story' || id === 'objective-route' ? document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`) : null;
      (restored ?? questButton.value)?.focus();
    }
  });
}
function switchCampus(id: CampusId) {
  if (mode.value !== 'exploring') return;
  if (id === campusId.value) return;
  idealActivity.value = null;
  campusModeFeedback.value = '';
  modelErrors.value = {};
  photoModelStatuses.value = {};
  scene?.resetJourney();
  clearJourneyView();
  selectedId.value = null;
  campusId.value = id;
  playerPosition.value = null; mapOpen.value = false;
  try { window.localStorage.setItem(CAMPUS_PREFERENCE_KEY, id); } catch { /* Keep the in-memory choice. */ }
  panel.value = 'quest';
  panelOpen.value = false;
  notice.value = '已切换校区，两个章节的印记分别保留。返回后可继续前往下一站。';
  try {
    scene?.setCampus(campus.value);
    qualityState.value = scene?.setRenderQuality(qualityMode.value) ?? null;
    restoreCampusMode();
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
  if (mode.value !== 'exploring') return;
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
function beginFlight() {
  if (mode.value !== 'exploring' || panelOpen.value || sceneError.value) return;
  if (!scene?.beginPaperplane()) { notice.value = '请沿台阶下到地面，靠近观景台旁的折叠站再开始。'; return; }
  photoStatus.value = null;
}
function endFlight() { scene?.endPaperplane(); planeSnapshot.value = null; mode.value = 'exploring'; syncScenePause(); focusScene(); }
function planeInput(input: PaperplaneInput) { scene?.setPaperplaneInput(input); }
function onSceneEvent(event: SceneEvent) {
  if (event.type === 'paperplane') {
    const previous = planeSnapshot.value;
    planeSnapshot.value = event.snapshot;
    mode.value = !event.snapshot ? 'exploring' : event.snapshot.paused ? 'paused' : event.snapshot.phase === 'ready' ? 'planeReady' : event.snapshot.phase === 'flying' ? 'flying' : 'planeResult';
    if (event.snapshot?.result === 'success' && previous?.result !== 'success') {
      journey.value = recordJourneyFlight(journey.value ?? createJourney(), { success: true, score: event.snapshot.elapsed }); notebookHidden.value = false; persistJourney();
    }
    return;
  }
  if (event.type === 'modelstatus') {
    if (PHOTO_POINTS.some(point => point.landmarkId === event.id)) photoModelStatuses.value = { ...photoModelStatuses.value, [event.id]: event.status };
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
    if (arrivalGuidanceId.value === event.id && quest.value.status !== 'active') { notice.value = '已到梅花教室附近，可以停下来阅读校园故事或继续自由漫游。'; }
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
  if (readingOpen.value) { if (event.key === 'Escape') { event.preventDefault(); closeReading(); } return; }
  if (hksOpen.value) return;
  if (planeActive.value) { if (event.key === 'Escape') { event.preventDefault(); endFlight(); } return; }
  if (event.key === 'Escape' && photoCompleteOpen.value) { event.preventDefault(); closePhotoComplete(); return; }
  if (event.key === 'Escape' && panelOpen.value) closePanel();
  const element = event.target as HTMLElement | null;
  if (event.code === 'KeyE' && !event.repeat && !element?.closest('input, textarea, select, [contenteditable=true]')) { event.preventDefault(); recordPhoto(); }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  photoTimer = window.setInterval(() => { updatePhotoStatus(); syncMinimap(); updateIdealActivity(); qualityState.value = scene?.getRenderQuality() ?? null; planeNearby.value = !!scene?.canBeginPaperplane(); }, 250);
  if (!sceneElement.value) return;
  try {
    scene = createCampusScene(sceneElement.value, campus.value, onSceneEvent);
    qualityState.value = scene?.setRenderQuality(qualityMode.value) ?? null;
    restoreCampusMode();
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
  <div class="app-shell" :inert="hksOpen || photoCompleteOpen || readingOpen" :aria-hidden="hksOpen || photoCompleteOpen || readingOpen ? 'true' : undefined">
    <header class="masthead">
      <div class="brand"><span class="brand-mark" aria-hidden="true">太</span><span>太理 <i>·</i> 时光漫游</span></div>
      <nav class="campus-switch" aria-label="选择校区">
        <button v-for="item in campusList" :key="item.id" type="button" :data-testid="`campus-${item.id}`" :disabled="planeActive" :aria-pressed="campusId === item.id" @click="switchCampus(item.id)">{{ item.name }}</button>
        <button type="button" data-testid="campus-mode-toggle" :aria-pressed="campusMode === 'ideal'" @click="toggleCampusMode">{{ campusMode === 'ideal' ? '理想校园 · 原创' : '基础校园' }}</button>
      </nav>
      <label class="quality-control">画质
        <select data-testid="render-quality-select" :value="qualityMode" :disabled="qualityState?.reference || !!sceneError" @change="chooseQuality">
          <option value="auto">自动均衡</option><option value="clear">清晰优先</option><option value="smooth">流畅优先</option>
        </select>
        <small data-testid="render-quality-status">{{ qualityState?.reference ? '固定参考画质' : qualityState ? `渲染倍率 ${qualityState.renderRatio.toFixed(2)}` : '准备场景' }}</small>
      </label>
    </header>

    <main class="scene-area" aria-label="校园漫游场景">
      <div ref="sceneElement" class="scene-canvas" aria-label="校园三维场景"></div>
      <div v-if="campusModeFeedback" class="campus-mode-feedback" data-testid="campus-mode-feedback" role="status">
        <span>{{ campusModeFeedback }}</span><button type="button" aria-label="关闭模式提示" @click="campusModeFeedback = ''">×</button>
      </div>
      <section v-if="idealActivity && idealPromptVisible" class="ideal-activity-card" :class="{ 'below-mode-feedback': !!campusModeFeedback }" data-testid="ideal-activity-card" aria-label="原创公共空间">
        <small>{{ campusId === 'huyu' ? '梅影书庭 · 开放阅读台' : '清泽柱廊 · 照片手记台' }}</small>
        <button v-if="idealActivity.available" type="button" data-testid="ideal-activity-open" @click="openIdealActivity">{{ idealActivity.label }} <span aria-hidden="true">↗</span></button>
        <p v-else>{{ idealActivity.distance > 2.4 ? `${idealActivity.direction} · 台面约 ${Math.ceil(idealActivity.distance)} 米` : idealActivity.reason }}</p>
        <small v-if="!idealActivity.available">{{ campusId === 'huyu' ? '从书庭东侧入口走入，阅读台在西廊下。' : '从柱廊南北两端走入，展示台在东侧。' }}</small>
      </section>
      <div class="scene-shade" aria-hidden="true"></div>
      <CampusMinimap :campus="campus" :position="playerPosition" :map-open="mapOpen" :disabled="!!sceneError || planeActive" @toggle="toggleOverview" />
      <section v-if="showCompactObjective && currentObjective" class="current-objective" data-testid="current-objective" :data-target-id="currentObjective.id" :data-distance="objectiveDistance?.toFixed(2)" :data-arrived="String(objectiveNearby)">
        <div class="objective-heading"><strong>{{ currentObjective.name }}</strong><span>{{ objectiveNearby ? '已到附近' : `${objectiveDirection} · 约 ${Math.round(objectiveDistance ?? 0)} 米（直线）` }}</span></div>
        <small v-if="campusId === 'huyu' && quest.status !== 'active'">{{ arrivalGuidanceId ? '沿铺装入校 · 前场向西，去梅花教室' : '从北门内侧，沿铺装认识校园' }}</small>
        <template v-if="campusId === 'yingxi'">
          <div data-testid="journey-panel" class="compact-actions"><button type="button" @click="startNotebook">开始手记</button><button type="button" @click="freeRoam">先去漫游</button>
            <details><summary @keydown.space.stop>故事与玩法</summary><div class="objective-details"><p>{{ CAMPUS_STORIES['yx-mechanical']!.text }}</p><p>机械馆、清泽园取景，再沿台阶登高、下台放飞；Hks 是可选支线。开始前不会创建新手记。</p><button type="button" @click="openNotebook">展开手记详情</button></div></details>
          </div>
        </template>
        <div v-else class="compact-actions"><button v-if="quest.status !== 'active' && currentObjective.id === 'hy-north-gate' && objectiveNearby" type="button" data-testid="continue-campus-arrival" @click="continueIntoCampus">去梅花教室</button><button type="button" data-testid="objective-story" :aria-label="CAMPUS_STORIES[currentObjective.id] ? '阅读校园故事' : '查看地标资料'" @click="openObjectiveStory($event.currentTarget)">{{ CAMPUS_STORIES[currentObjective.id] ? '故事' : '资料' }}</button><button type="button" data-testid="objective-route" aria-label="展开漫游路线" @click="showPanel('quest', $event.currentTarget)">路线</button></div>
      </section>

      <PhotoJournal v-if="campusId === 'yingxi' && !hksOpen && !planeActive && (!idealPromptVisible || photoCompleteOpen) && (!showNotebook || photoCompleteOpen)" :point="photoPoint" :stamps="journey?.photos ?? []" :photos="photoImages" :status="photoStatus" :disabled="!!sceneError" :view-available="photoViewAvailable" :model-status="photoModelStatus" :panel-open="panelOpen" :feedback="photoFeedback" :complete-open="photoCompleteOpen" @record="recordPhoto" @close="closePhotoComplete()" @open="openPhotoComplete" @replay="replayPhotos" @select="selectPhotoPoint" />

      <JourneyPanel v-if="campusId === 'yingxi' && showNotebook && (journey || notebookExpanded) && !idealPromptVisible && !planeActive && !photoCompleteOpen && !hksOpen && !panelOpen" :state="journey" :saved="journeySaved" :campus-id="campusId" @start="startNotebook" @continue="continueNotebook" @restart="restartNotebook" @free-roam="freeRoam" @flight="beginFlight" @confirming="confirmNotebook" />
      <button v-if="campusId === 'yingxi' && !planeActive && mode === 'exploring' && planeNearby && !panelOpen" class="plane-station-button" data-testid="begin-paperplane" type="button" @click="beginFlight">纸飞机站 · 准备起飞</button>
      <PaperplanePanel v-if="planeSnapshot" :snapshot="planeSnapshot" @launch="launchFlight" @retry="scene?.retryPaperplane()" @exit="endFlight" @resume="resumeFlight" @input="planeInput" />
      <div v-if="sceneError" class="error-banner" data-testid="scene-error" role="status">
        <strong>无障碍列表模式</strong><span>{{ sceneError }}</span>
        <button type="button" @click="showPanel('quest', $event.currentTarget)">打开旅程</button>
      </div>

      <div v-if="!planeActive" class="scene-actions" aria-label="场景工具">
        <button type="button" aria-label="打开校园地图" title="校园地图" :disabled="!!sceneError" @click="scene?.overview()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M8 12h8M12 8v8"/></svg></button>
        <button type="button" aria-label="聚焦当前站点" title="聚焦当前站点" :disabled="!!sceneError || !(target || selected)" @click="(target || selected) && scene?.focusLandmark((target || selected)!.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>
        <button type="button" data-testid="reset-view" aria-label="返回人物视角" title="返回人物视角" :disabled="!!sceneError" @click="scene?.resetView(); focusScene()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 1 2 6M4 4v7h7"/></svg></button>
      </div>
      <div v-if="travelling && target && !showCompactObjective && campusId !== 'yingxi' && !panelOpen" class="direction-hint">前往 {{ target.name }} <span>·</span> 金线仅指方向，遇建筑请绕行</div>
      <div v-if="!planeActive" class="panel-launchers">
        <button v-if="campusId === 'yingxi' && journey" type="button" data-testid="open-photo-album" @click="openPhotoComplete">照片集</button>
        <button v-if="campusId === 'yingxi'" type="button" data-testid="open-notebook" @click="openNotebook">晴日手记</button>
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
            <template v-if="displayedStory">
              <p class="facts" data-testid="campus-story">{{ displayedStory.text }}</p>
              <p class="story-invitation">{{ displayedStory.invitation }}</p>
              <a :href="displayedStory.source" target="_blank" rel="noopener noreferrer">官方校园故事 · 报道 {{ displayedStory.date }}</a>
            </template>
            <details class="model-evidence" :open="!displayedStory"><summary @keydown.space.stop>模型与地点依据</summary>
            <p class="facts">{{ displayed.facts }}</p>
            <div v-if="displayedFeature" class="metric-note">轮廓：米制坐标 · 高 {{ displayedFeature.height }} m（{{ heightLabel(displayedFeature.heightStatus) }}）<template v-if="displayedFeature.levels !== null"> · {{ displayedFeature.levels }} 层</template></div>
            <div class="source-note">地点来源：<a v-if="safeUrl(displayed.source)" :href="safeUrl(displayed.source)!" target="_blank" rel="noopener noreferrer">{{ displayed.source }}</a><span v-else>{{ displayed.source }}</span><template v-if="displayedFeature"><br>轮廓来源：<a v-if="safeUrl(displayedFeature.source)" :href="safeUrl(displayedFeature.source)!" target="_blank" rel="noopener noreferrer">{{ displayedFeature.source }}</a><span v-else>{{ displayedFeature.source }}</span></template></div>
            <p v-if="displayedFeature?.heightSource" class="facts">楼高依据：{{ displayedFeature.heightSource.dataset }}<template v-if="displayedFeature.heightSource.year"> · {{ displayedFeature.heightSource.year }}</template><template v-if="displayedFeature.heightSource.matchIoU !== undefined"> · 轮廓重叠 {{ Math.round(displayedFeature.heightSource.matchIoU * 100) }}%</template>。<a v-if="safeUrl(displayedFeature.heightSource.source)" :href="safeUrl(displayedFeature.heightSource.source)!" target="_blank" rel="noopener noreferrer">查看高度来源</a></p>
            <p v-if="safeUrl(displayed.visualSource)" class="facts"><a :href="safeUrl(displayed.visualSource)!" target="_blank" rel="noopener noreferrer">建筑外观参考来源</a></p>
            </details>
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
      <div class="attribution">{{ campus.attribution }} <span>·</span> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> <span>·</span> 布局参考 · 楼高估算 · 景观为设计补全 <span>·</span> <a href="./data/sources/README.md" target="_blank" rel="noopener noreferrer">数据来源与许可</a></div>
    </main>

    <footer class="journey-bar" data-testid="quest-status">
      <div class="bar-label"><span class="bar-icon" aria-hidden="true">✳</span><div><small>YOUR JOURNEY</small><strong>{{ travelling ? '自由前往目的地' : quest.status === 'completed' ? '本章已完成' : quest.status === 'active' ? (target?.name ?? '旅程进行中') : '准备出发' }}</strong></div></div>
      <div class="bar-route" :aria-label="`已记录 ${quest.visited.length} / ${orderedLandmarks.length} 站`"><template v-for="(item, index) in orderedLandmarks" :key="item.id"><span v-if="index > 0" class="route-line"></span><span class="route-stop" :class="{ done: quest.visited.includes(item.id), current: target?.id === item.id }" :title="item.name">{{ quest.visited.includes(item.id) ? '✳' : String(index + 1).padStart(2, '0') }}</span></template></div>
      <div class="bar-end"><span>{{ quest.status === 'active' ? '下一站' : '漫游进度' }}</span><strong>{{ quest.visited.length }} <i>/</i> {{ orderedLandmarks.length }}</strong></div>
    </footer>
    <div class="control-caption" aria-hidden="true"><b>W A S D</b> 行走 <span>·</span> 拖动视角 <span>·</span> Shift 跑步 <span>·</span> Space 跳跃</div>
    <div class="sr-only" aria-live="polite">{{ notice }}</div>
  </div>
  <div v-if="!orientationDismissed && !photoCompleteOpen && !hksOpen && !readingOpen" class="orientation-prompt" role="status" data-testid="orientation-prompt">
    <svg class="orientation-icon" viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="13" width="20" height="34" rx="3" transform="rotate(-18 32 30)"/><path d="M47 17a22 22 0 0 1 6 20M53 37l4-6M53 37l-7-2M17 47a22 22 0 0 1-6-20M11 27l-4 6M11 27l7 2"/></svg><strong>建议横屏漫游</strong><small>{{ orientationMessage }}</small>
    <button type="button" data-testid="orientation-fullscreen" :disabled="orientationBusy" @click="tryLandscape">尝试全屏横屏</button>
    <button type="button" data-testid="orientation-dismiss" @click="dismissOrientation">继续竖屏浏览</button>
  </div>
  <div v-if="readingOpen" class="reading-backdrop">
    <section ref="readingDialog" class="reading-sheet" data-testid="ideal-reading-dialog" role="dialog" aria-modal="true" aria-labelledby="reading-title" @keydown="trapReadingFocus" @keydown.esc.stop.prevent="closeReading">
      <button ref="readingCloseButton" type="button" class="reading-close" aria-label="关闭校园介绍" @click="closeReading">×</button>
      <small>梅影书庭 · 原创阅读空间</small><h2 id="reading-title">在廊下，读一读{{ campus.name }}</h2>
      <p>{{ campus.description }}</p>
      <p class="reading-note">书庭是基于校园布局的原创设计，不是现实建筑复原。以下介绍沿用地点资料；阅读不会移动人物或改变旅程进度。</p>
      <article v-for="item in campus.landmarks" :key="item.id">
        <h3>{{ item.name }}</h3><p>{{ CAMPUS_STORIES[item.id]?.text ?? item.facts }}</p>
        <p v-if="CAMPUS_STORIES[item.id]">{{ CAMPUS_STORIES[item.id]!.invitation }}</p>
        <a v-if="CAMPUS_STORIES[item.id]" :href="CAMPUS_STORIES[item.id]!.source" target="_blank" rel="noopener noreferrer">官方故事 · 报道 {{ CAMPUS_STORIES[item.id]!.date }}</a>
        <details v-if="CAMPUS_STORIES[item.id]"><summary @keydown.space.stop>模型与地点依据</summary><p>{{ item.facts }}</p></details>
        <a v-if="safeUrl(item.source)" :href="safeUrl(item.source)!" target="_blank" rel="noopener noreferrer">查看资料来源 ↗</a>
        <span v-else>{{ item.source }}</span>
      </article>
      <button type="button" class="reading-return" @click="closeReading">合上介绍，继续漫游</button>
    </section>
  </div>
  <HksOverlay v-if="hksOpen" @close="closeHks" />
</template>

<style scoped>
.current-objective { position:absolute; left:186px; top:18px; z-index:8; width:min(310px,calc(100% - 204px)); box-sizing:border-box; display:flex; flex-direction:column; gap:5px; padding:9px 12px; border:1px solid #cbd5c4; border-radius:10px; background:#faf8efed; color:#294534; font-size:12px; }
.objective-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; }.current-objective strong { font-size:16px; }.current-objective small { color:#637666; }
.current-objective button,.current-objective summary { min-height:36px; box-sizing:border-box; padding:5px 9px; background:#fffdf4; color:#294534; border:1px solid #adbdac; border-radius:6px; cursor:pointer; font:inherit; }
.current-objective summary { display:flex; align-items:center; }.compact-actions { display:flex; flex-wrap:wrap; gap:6px; }.current-objective details { line-height:1.5; }
.objective-details { position:absolute; top:calc(100% + 6px); left:0; right:0; padding:10px 12px; border:1px solid #cbd5c4; border-radius:8px; background:#faf8effa; max-height:min(260px,40vh); overflow:auto; }.objective-details p { margin:0 0 8px; }
.current-objective :focus-visible,.quality-control select:focus-visible { outline:3px solid #bc7547; outline-offset:3px; }
@media(max-height:550px),(max-width:700px) { .current-objective { top:8px;left:118px;width:min(300px,calc(100% - 130px));padding:7px 10px;gap:3px; }.current-objective strong { font-size:15px; }.current-objective button,.current-objective summary { min-height:44px; } }

.quality-control { display:grid; grid-template-columns:auto auto; align-items:center; gap:2px 6px; font-size:12px; color:#344a3e; }
.quality-control select { min-height:36px; max-width:105px; border:1px solid #b7c5b9; border-radius:6px; background:#fffdf5; color:inherit; }
.quality-control small { grid-column:1 / -1; font-size:10px; text-align:right; }
.model-evidence { margin:12px 0; font-size:12px; }.model-evidence summary { cursor:pointer; }
.story-invitation { color:#405d4d; line-height:1.6; }
@media(max-width:900px) { .quality-control { gap:0; font-size:0; }.quality-control small { display:none; }.quality-control select { max-width:85px; font-size:11px; } }

.ideal-activity-card { position:absolute; right:18px; top:18px; z-index:8; width:210px; padding:12px 14px; color:#294737; background:#f8f5e9ed; border-left:3px solid #9c7549; box-shadow:0 4px 18px #243a351a; }
.ideal-activity-card.below-mode-feedback { top:104px; }
.ideal-activity-card small { display:block; font-size:11px; line-height:1.6; }
.ideal-activity-card p { font-size:13px; margin:8px 0; }
.ideal-activity-card button { width:100%; min-height:44px; margin-top:8px; background:#294737; color:#fffdf1; border:0; padding:8px; cursor:pointer; }
.reading-backdrop { position:fixed; inset:0; z-index:100; display:grid; place-items:center; background:#17271f9e; padding:16px; }
.reading-sheet { position:relative; max-width:660px; width:100%; max-height:calc(100dvh - 32px); overflow:auto; background:#f5f1e5; color:#294737; padding:32px; box-sizing:border-box; }
.reading-sheet h2 { font-size:26px; margin:12px 40px 20px 0; }.reading-sheet p { line-height:1.8; font-size:14px; }.reading-sheet article { padding:16px 0; border-top:1px solid #cbd0bd; }.reading-sheet h3 { margin:0; }.reading-sheet a { color:#385f4c; font-size:13px; }.reading-note { color:#697565; }
.reading-close { position:absolute; right:12px; top:12px; width:44px; height:44px; background:none; color:inherit; border:0; font-size:26px; cursor:pointer; }.reading-return { padding:12px 18px; min-height:44px; background:#294737; color:#fffdf1; border:0; cursor:pointer; }
.ideal-activity-card button:focus-visible,.reading-sheet :is(button,a):focus-visible { outline:3px solid #bc7547; outline-offset:3px; }
@media(max-width:620px) { .ideal-activity-card,.ideal-activity-card.below-mode-feedback { top:auto; bottom:172px; right:12px; width:190px; padding:8px 10px; }.reading-sheet { padding:24px 18px; }.reading-sheet h2 { font-size:22px; } }

@media(max-height:550px) and (orientation:landscape) { .ideal-activity-card,.ideal-activity-card.below-mode-feedback { top:auto; bottom:68px; right:154px; width:min(210px,calc(100% - 310px)); padding:8px 10px; } }

.campus-mode-feedback { position: absolute; z-index: 12; top: 12px; left: 50%; transform: translateX(-50%); width: min(560px, calc(100% - 32px)); padding: 10px 14px; display: flex; align-items: center; gap: 12px; color: #263e35; background: #fffdf3; border: 1px solid #b5bda8; border-radius: 10px; box-shadow: 0 3px 16px #243a3522; font-size: 13px; }
.campus-mode-feedback button { margin-left: auto; flex-shrink: 0; min-width: 32px; min-height: 32px; color: inherit; background: transparent; border: 0; font-size: 22px; }
</style>
