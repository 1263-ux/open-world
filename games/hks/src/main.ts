import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { TutorialScene } from './TutorialScene';
import { GameScene } from './GameScene';
import { SoundManager } from './SoundManager';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

function notify(type: string): void {
  window.parent.postMessage({ type }, location.origin === 'null' ? '*' : location.origin);
}

let game: Phaser.Game | undefined;
try {
  game = new Phaser.Game({
    type: Phaser.AUTO, width: GAME_WIDTH, height: GAME_HEIGHT,
    parent: 'game-container', backgroundColor: '#1a1a2e', pixelArt: true, roundPixels: true,
    scene: [MenuScene, TutorialScene, GameScene],
    input: { windowEvents: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
  const currentGame = game;
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  const updateOrientation = () => { if (portrait.matches) currentGame.pause(); else currentGame.resume(); };
  currentGame.events.once(Phaser.Core.Events.READY, () => { updateOrientation(); notify('hks:ready'); });
  portrait.addEventListener('change', updateOrientation);
  window.addEventListener('pagehide', () => portrait.removeEventListener('change', updateOrientation), { once: true });
  let lastSnapshot = 0;
  currentGame.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (!currentGame.canvas || performance.now() - lastSnapshot < 250) return;
    lastSnapshot = performance.now();
    currentGame.canvas.dataset.logicalWidth = String(GAME_WIDTH);
    currentGame.canvas.dataset.logicalHeight = String(GAME_HEIGHT);
    // Read-only observation for real-input QA; never mutates gameplay state.
    const scene = currentGame.scene.getScene('GameScene') as unknown as {
      gameTime?: number; isPaused?: boolean; isGameOver?: boolean; levelUpPanelActive?: boolean;
      killCount?: number; player?: { x: number; y: number; level: number }; monsters?: unknown[];
      building?: { x: number; y: number; structures: Map<string, { currentHp: number; maxHp: number }> };
      expOrbs?: Array<{ x: number; y: number; value: number; lifetime: number; graphic: { active: boolean } }>;
      lastOutcome?: 'victory' | 'defeat' | null;
      settlementButton?: { x: number; y: number } | null;
      lastOutcomeStructures?: Record<string, { currentHp: number; maxHp: number }> | null;
      hud?: { levelUpElements?: Array<{ x: number; y: number; active: boolean; visible: boolean; alpha: number; texture?: { key: string }; input?: { enabled: boolean }; getData?: (key: string) => unknown }> };
      bossSpawned?: boolean; bossKilled?: boolean;
      boss?: { hp: number; maxHp: number; isActive: boolean; isDead: boolean } | null;
    };
    const player = scene?.player;
    const nearestXP = player ? (scene?.expOrbs ?? []).reduce<{ x: number; y: number; value: number; distance: number } | null>((nearest, orb) => {
      if (!orb.graphic.active || orb.lifetime <= 0) return nearest;
      const distance = Math.hypot(orb.x - player.x, orb.y - player.y);
      return !nearest || distance < nearest.distance ? { x: orb.x, y: orb.y, value: orb.value, distance } : nearest;
    }, null) : null;
    const tutorial = currentGame.scene.getScene('TutorialScene') as unknown as { currentPage?: number };
    currentGame.canvas.dataset.hksState = JSON.stringify({
      scene: currentGame.scene.getScenes(true).map(s => s.scene.key).join(','),
      tutorialPage: currentGame.scene.isActive('TutorialScene') ? tutorial.currentPage ?? null : null,
      remaining: scene?.gameTime, paused: scene?.isPaused, ended: scene?.isGameOver,
      levelUp: scene?.levelUpPanelActive, kills: scene?.killCount,
      x: scene?.player?.x, y: scene?.player?.y, level: scene?.player?.level,
      monsters: scene?.monsters?.length, nearestXP,
      settlementButton: scene?.settlementButton ?? null,
      outcome: scene?.lastOutcome ?? null, outcomeStructures: scene?.lastOutcomeStructures ?? null,
      upgradeCards: scene?.levelUpPanelActive ? (scene.hud?.levelUpElements ?? [])
        .filter(card => card.active && card.visible && card.alpha > 0 && card.input?.enabled && card.texture?.key.startsWith('card_'))
        .map(card => ({ x: card.x, y: card.y, displayed: card.getData?.('displayedCard') ?? null })) : [],
      building: scene?.building ? { x: scene.building.x, y: scene.building.y,
        structures: Object.fromEntries([...scene.building.structures].map(([type, hp]) => [type, { currentHp: hp.currentHp, maxHp: hp.maxHp }])) } : null,
      boss: { spawned: scene?.bossSpawned ?? false, killed: scene?.bossKilled ?? false,
        hp: scene?.boss?.hp ?? null, maxHp: scene?.boss?.maxHp ?? null,
        active: scene?.boss?.isActive ?? false, dead: scene?.boss?.isDead ?? false },
    });
  });
} catch (error) {
  console.error('Hks initialization failed', error);
  const el = document.getElementById('error-screen');
  if (el) el.style.display = 'flex';
  notify('hks:error');
}
window.addEventListener('pagehide', () => {
  SoundManager.dispose();
  game?.destroy(true, false);
  game = undefined;
}, { once: true });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); notify('hks:return'); }
});
window.addEventListener('error', () => notify('hks:error'));
window.addEventListener('unhandledrejection', () => notify('hks:error'));
