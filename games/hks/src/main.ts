import Phaser from 'phaser';
import { MenuScene } from './MenuScene';
import { TutorialScene } from './TutorialScene';
import { GameScene } from './GameScene';
import { SoundManager } from './SoundManager';
import { VFX } from './VFX';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

function notify(type: string) { window.parent.postMessage({ type }, location.origin); }

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
    };
    // Read-only runtime evidence for QA; no commands, cheats or state injection.
    game.canvas.dataset.hksState = JSON.stringify({
      scene: game.scene.getScenes(true).map(s => s.scene.key).join(','),
      remaining: scene?.gameTime, paused: scene?.isPaused, ended: scene?.isGameOver,
      levelUp: scene?.levelUpPanelActive, kills: scene?.killCount,
      x: scene?.player?.x, y: scene?.player?.y, level: scene?.player?.level,
      monsters: scene?.monsters?.length,
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
