import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { TutorialScene } from './TutorialScene';
import { GameScene } from './GameScene';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

function notify(type: string) { window.parent.postMessage({ type }, location.origin === 'null' ? '*' : location.origin); }

/** Original Hks runs in its own page; nothing is imported into the campus bundle. */
export function createHksGame(container: string) {
  const game = new Phaser.Game({
    type: Phaser.AUTO, width: GAME_WIDTH, height: GAME_HEIGHT,
    parent: container, backgroundColor: '#1a1a2e', pixelArt: true, roundPixels: true,
    scene: [MenuScene, TutorialScene, GameScene],
    // Keep input listeners in this iframe, never on window.top after it is removed.
    input: { windowEvents: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
  game.events.once(Phaser.Core.Events.READY, () => notify('hks:ready'));
  let lastSnapshot = 0;
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (!game.canvas || performance.now() - lastSnapshot < 250) return;
    lastSnapshot = performance.now();
    game.canvas.dataset.logicalWidth = String(game.scale.gameSize.width);
    game.canvas.dataset.logicalHeight = String(game.scale.gameSize.height);
    const scene = game.scene.getScene('GameScene') as unknown as {
      gameTime?: number; isPaused?: boolean; isGameOver?: boolean;
      levelUpPanelActive?: boolean; killCount?: number;
      player?: { x: number; y: number; level: number };
      monsters?: unknown[];
      lastOutcome?: 'victory' | 'defeat' | null;
      lastOutcomeStructures?: Record<string, { currentHp: number; maxHp: number }> | null;
      building?: { x: number; y: number; structures: Map<string, { currentHp: number; maxHp: number }> };
      expOrbs?: Array<{ x: number; y: number; value: number; lifetime: number; graphic: { active: boolean } }>;
      bossSpawned?: boolean; bossKilled?: boolean;
      boss?: { hp: number; maxHp: number; isActive: boolean; isDead: boolean } | null;
      hud?: { levelUpElements?: Array<{ x: number; y: number; active: boolean; texture?: { key: string }; input?: { enabled: boolean } }> };
    };
    const player = scene?.player;
    const nearestXP = player ? (scene?.expOrbs ?? []).reduce<{ x: number; y: number; value: number; distance: number } | null>((nearest, orb) => {
      if (!orb.graphic.active || orb.lifetime <= 0) return nearest;
      const distance = Math.hypot(orb.x - player.x, orb.y - player.y);
      return !nearest || distance < nearest.distance ? { x: orb.x, y: orb.y, value: orb.value, distance } : nearest;
    }, null) : null;
    // Read-only runtime evidence for QA; no commands, cheats or state injection.
    game.canvas.dataset.hksState = JSON.stringify({
      scene: game.scene.getScenes(true).map(s => s.scene.key).join(','),
      remaining: scene?.gameTime, paused: scene?.isPaused, ended: scene?.isGameOver,
      levelUp: scene?.levelUpPanelActive, kills: scene?.killCount,
      x: scene?.player?.x, y: scene?.player?.y, level: scene?.player?.level,
      monsters: scene?.monsters?.length,
      nearestXP,
      building: scene?.building ? {
        x: scene.building.x, y: scene.building.y,
        structures: Object.fromEntries([...scene.building.structures].map(([type, hp]) => [type, { currentHp: hp.currentHp, maxHp: hp.maxHp }])),
      } : null,
      boss: {
        spawned: scene?.bossSpawned ?? false, killed: scene?.bossKilled ?? false,
        hp: scene?.boss?.hp ?? null, maxHp: scene?.boss?.maxHp ?? null,
        active: scene?.boss?.isActive ?? false, dead: scene?.boss?.isDead ?? false,
      },
      outcome: scene?.lastOutcome ?? null,
      outcomeStructures: scene?.lastOutcomeStructures ?? null,
      upgradeCards: scene?.levelUpPanelActive ? (scene?.hud?.levelUpElements ?? [])
        .filter(card => card.active && card.input?.enabled && card.texture?.key.startsWith('card_'))
        .map(card => ({ x: card.x, y: card.y })) : [],
    });
  });
  return () => {
    SoundManager.dispose();
    VFX.reset();
    game.destroy(true, false);
  };
}

let dispose: (() => void) | undefined;
try { dispose = createHksGame('game-container'); }
catch (error) { console.error('Hks initialization failed', error); notify('hks:error'); }
window.addEventListener('pagehide', () => { dispose?.(); dispose = undefined; }, { once: true });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); notify('hks:return'); }
});
window.addEventListener('error', () => notify('hks:error'));
window.addEventListener('unhandledrejection', () => notify('hks:error'));
