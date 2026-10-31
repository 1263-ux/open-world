import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  chooseDisplayedUpgrade, chooseMovement, GAME_SECONDS, isDisplayedCard, TRIAL_MS, validateOutcome, validateSurvivalState,
  type Point, type SurvivalState,
} from './hks-survival-policy';

async function readState(canvas: Locator): Promise<unknown> {
  return JSON.parse(await canvas.getAttribute('data-hks-state', { timeout: 5000 }) ?? '{}');
}
async function clickLogical(page: Page, canvas: Locator, point: Point, deadline = Infinity) {
  const box = await canvas.boundingBox({ timeout: 5000 });
  const width = Number(await canvas.getAttribute('data-logical-width'));
  const height = Number(await canvas.getAttribute('data-logical-height'));
  if (!box || !(width > 0 && height > 0)) throw new Error('Hks canvas bounds/logical size unavailable');
  if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) throw new Error('Hks click is outside the actual logical canvas');
  if (Date.now() >= deadline) return false;
  await page.mouse.click(box.x + point.x / width * box.width, box.y + point.y / height * box.height);
  return true;
}
async function logicalSize(canvas: Locator) {
  return { width: Number(await canvas.getAttribute('data-logical-width')), height: Number(await canvas.getAttribute('data-logical-height')) };
}

// Opt in explicitly and select this file. Ordinary CSS/feature CI skips the long trial.
// RUN_HKS_SURVIVAL=1 npm run test:e2e -- tests/e2e/hks-survival.spec.ts --workers=1 --retries=0
// RUN_HKS_DEEPPLAY=1 npm run test:e2e -- tests/e2e/hks-survival.spec.ts --workers=1 --retries=0
// No evaluate(), injected events, debug keys, network fixtures, clock changes or game-state writes.
async function runNaturalTrial(page: Page, testInfo: TestInfo, orbitRadius: number) {
  testInfo.setTimeout(TRIAL_MS + 90_000);
  const errors: string[] = [];
  const history: Array<{ wallMs: number; state: SurvivalState }> = [];
  const actions: Array<{ wallMs: number; kind: string; keys?: string[]; target?: Point; candidates?: unknown; chosen?: unknown; structures?: unknown }> = [];
  const milestones: string[] = [];
  const held = new Set<string>();
  let trialStartedAt: number | null = null;
  let lastState: SurvivalState | null = null;
  let terminalObservedWallMs: number | null = null;
  let stopReason = 'setup';
  let failure: unknown;
  const wallMs = () => trialStartedAt === null ? 0 : Date.now() - trialStartedAt;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const setKeys = async (keys: string[], deadline = Infinity) => {
    for (const key of held) if (!keys.includes(key)) { await page.keyboard.up(key); held.delete(key); }
    for (const key of keys) if (!held.has(key) && Date.now() < deadline) { await page.keyboard.down(key); held.add(key); }
    return [...held];
  };
  const screenshot = async (label: string) => {
    const filename = `hks-survival-${label}.png`;
    const path = testInfo.outputPath(filename);
    await page.screenshot({ path, fullPage: true, timeout: 10000 });
    await testInfo.attach(label, { path, contentType: 'image/png' });
    milestones.push(filename);
  };

  try {
    await page.goto('/');
    await page.getByTestId('open-hks').click();
    await expect(page.getByTestId('hks-overlay')).toBeVisible();
    await expect(page.getByTestId('hks-loading')).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByTestId('hks-error')).toHaveCount(0);
    const canvas = page.frameLocator('[data-testid="hks-frame"]').locator('canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => (await readState(canvas) as { scene?: string }).scene).toContain('MenuScene');
    await screenshot('menu');
    const { width } = await logicalSize(canvas);
    await clickLogical(page, canvas, { x: width / 2, y: 395 });
    await expect.poll(async () => (await readState(canvas) as { scene?: string }).scene, { timeout: 10000 }).toContain('TutorialScene');
    await clickLogical(page, canvas, { x: width - 44, y: 37 });
    await expect.poll(async () => (await readState(canvas) as { scene?: string }).scene, { timeout: 15000 }).toContain('GameScene');
    const initial = await readState(canvas);
    validateSurvivalState(initial);
    lastState = initial;
    expect(initial.remaining).toBeGreaterThan(GAME_SECONDS - 10);
    expect(initial.ended).toBe(false);
    expect(initial.outcome).toBeNull();
    trialStartedAt = Date.now();
    await screenshot('start');

    let lastClockProgressAt = Date.now();
    let previousRemaining = initial.remaining;
    let pausedSince: number | null = null;
    let nextPeriodicWallMs = 30_000;
    let observedLevel = initial.level;
    let observedBoss = false;
    let observedBossKill = false;
    let upgradeScreenshots = 0;
    let popupScreenshots = 0;
    let lastPlayerPosition = { x: initial.x, y: initial.y };
    let stuckSince: number | null = null;
    let evadeUntil = 0;
    let lastCommandMoved = false;
    stopReason = 'playing';
    while (wallMs() < TRIAL_MS) {
      const raw = await readState(canvas);
      validateSurvivalState(raw);
      const state = raw;
      lastState = state;
      history.push({ wallMs: wallMs(), state });
      if (errors.length) throw new Error(`Runtime error during natural play: ${errors.join('; ')}`);
      if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
      if (state.ended) { terminalObservedWallMs = wallMs(); stopReason = `natural-${state.outcome ?? 'unknown'}`; break; }
      const now = Date.now();
      if (state.remaining < previousRemaining - 0.02) lastClockProgressAt = now;
      previousRemaining = state.remaining;
      if (state.paused) pausedSince ??= now; else pausedSince = null;
      if (pausedSince !== null && now - pausedSince > 15_000) throw new Error('Hks popup/upgrade softlock: actual clicks did not resume play within 15 seconds');
      if (!state.paused && now - lastClockProgressAt > 15_000) throw new Error('Hks runtime softlock: game clock made no progress for 15 seconds');

      if (state.boss.spawned && !observedBoss) {
        observedBoss = true;
        await setKeys([]);
        await screenshot('boss-spawn');
      }
      if (state.boss.killed && !observedBossKill) {
        observedBossKill = true;
        await setKeys([]);
        await screenshot('boss-killed');
      }
      if (state.level > observedLevel) {
        observedLevel = state.level;
        if ([2, 5, 10, 15, 20].includes(state.level)) { await setKeys([]); await screenshot(`level-${state.level}`); }
      }
      if (wallMs() >= nextPeriodicWallMs) {
        await setKeys([]);
        await screenshot(`wall-${Math.floor(wallMs() / 1000)}s`);
        nextPeriodicWallMs += 30_000;
      }

      if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
      if (state.levelUp) {
        await setKeys([]);
        if (upgradeScreenshots < 8) await screenshot(`upgrade-${++upgradeScreenshots}`);
        if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
        if (!state.upgradeCards.length) throw new Error('Upgrade panel reports active but no real available card is exposed');
        // Choose only among active cards actually shown in the panel. Names,
        // levels and descriptions are read-only mirrors of the visible text.
        if (!state.upgradeCards.every(isDisplayedCard)) throw new Error('Active upgrade cards are missing displayed text');
        const candidates = state.upgradeCards;
        const card = chooseDisplayedUpgrade(candidates, state.building.structures);
        if (!await clickLogical(page, canvas, card, trialStartedAt + TRIAL_MS)) { stopReason = 'purpose-window-no-outcome'; break; }
        actions.push({ wallMs: wallMs(), kind: 'select-available-upgrade', target: {x:card.x,y:card.y}, candidates, chosen:card.displayed, structures:state.building.structures });
        await page.waitForTimeout(Math.min(500, Math.max(1, TRIAL_MS - wallMs())));
      } else if (state.paused) {
        await setKeys([]);
        if (popupScreenshots < 5) await screenshot(`knowledge-${++popupScreenshots}`);
        if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
        const size = await logicalSize(canvas);
        if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
        const point = { x: size.width * 0.88, y: size.height * 0.88 };
        const popup = page.frameLocator('[data-testid="hks-frame"]').locator('#monster-popup');
        if (!await popup.isVisible()) throw new Error('Paused without an observable knowledge popup');
        if (wallMs() >= TRIAL_MS) { stopReason = 'purpose-window-no-outcome'; break; }
        await popup.click();
        actions.push({ wallMs: wallMs(), kind: 'close-actual-knowledge-popup', target: point });
        await page.waitForTimeout(Math.min(500, Math.max(1, TRIAL_MS - wallMs())));
      } else {
        const moved = Math.hypot(state.x - lastPlayerPosition.x, state.y - lastPlayerPosition.y);
        if (lastCommandMoved && moved < 3) stuckSince ??= now; else stuckSince = null;
        if (stuckSince !== null && now - stuckSince > 2000) { evadeUntil = now + 1800; stuckSince = null; }
        lastPlayerPosition = { x: state.x, y: state.y };
        const movement = chooseMovement(now < evadeUntil ? { ...state, nearestXP: null } : state, orbitRadius);
        const pressed = await setKeys(movement.keys, trialStartedAt + TRIAL_MS);
        actions.push({ wallMs: wallMs(), kind: movement.kind, keys: pressed, target: movement.target });
        lastCommandMoved = movement.keys.length > 0;
        await page.waitForTimeout(Math.min(movement.holdMs, Math.max(1, TRIAL_MS - wallMs())));
        await setKeys([]);
      }
    }
    await setKeys([]);
    // A late snapshot is saved, but cannot turn an unobserved deadline into a pass.
    const final = await readState(canvas);
    validateSurvivalState(final);
    lastState = final;
    history.push({ wallMs: wallMs(), state: final });
    if (final.ended && wallMs() < TRIAL_MS && terminalObservedWallMs === null) terminalObservedWallMs = wallMs();
    stopReason = terminalObservedWallMs !== null ? `natural-${final.outcome ?? 'unknown'}` : 'purpose-window-no-outcome';
    await screenshot(final.ended ? `outcome-${final.outcome}` : 'no-outcome-deadline');
    if (terminalObservedWallMs === null) throw new Error('No natural terminal outcome observed within the 600-second purpose window');
    validateOutcome(final);
    expect(errors, 'Natural play must have no uncaught runtime or console errors').toEqual([]);
    // Exit with a real supported control, then confirm the campus loop resumed.
    await page.getByTestId('hks-return').click();
    await expect(page.getByTestId('hks-overlay')).toHaveCount(0);
    await expect(page.getByTestId('campus-canvas')).toHaveAttribute('data-paused', 'false');
    await page.waitForTimeout(250);
    expect(errors, 'Returning from the trial must not emit shutdown/runtime errors').toEqual([]);
  } catch (error) {
    failure = error;
    if (stopReason === 'playing' || stopReason === 'setup') stopReason = 'runtime-or-trial-failure';
    await setKeys([]).catch(() => undefined);
    await screenshot('failure').catch(() => undefined);
  } finally {
    await setKeys([]).catch(() => undefined);
    const summary = {
      codeIdentity: process.env.HKS_TRIAL_CODE_IDENTITY ?? process.env.GITHUB_SHA ?? 'not supplied; do not associate with another candidate',
      strategy: `Nearest XP within 270px player / 310px building with a collision-free direct path; otherwise ${orbitRadius}px near-building orbit; rank only actual displayed cards, genuine input.`,
      orbitRadius,
      scope: 'One random, unseeded, real-input bot attempt. Natural loss is valid evidence, not a CI failure. A passing trial alone is not a victory, Boss encounter, balance or general winnability claim.',
      stopReason, purposeWindowMs: TRIAL_MS, wallElapsedMs: wallMs(), terminalObservedWallMs,
      gameElapsedSeconds: lastState ? GAME_SECONDS - lastState.remaining : null,
      outcome: lastState?.outcome ?? null, level: lastState?.level ?? null, kills: lastState?.kills ?? null,
      structures: lastState?.building.structures ?? null, outcomeStructures: lastState?.outcomeStructures ?? null, boss: lastState?.boss ?? null,
      samples: history.length, actions: actions.length, milestones, errors,
      failure: failure instanceof Error ? failure.message : failure ? String(failure) : null,
      finalState: lastState,
    };
    await mkdir(testInfo.outputDir, { recursive: true });
    for (const [name, data] of [['summary', summary], ['timeline', history], ['inputs', actions]] as const) {
      const path = testInfo.outputPath(`hks-survival-${name}.json`);
      await writeFile(path, JSON.stringify(data, null, 2));
      await testInfo.attach(`hks-survival-${name}`, { path, contentType: 'application/json' });
    }
    // One concise line remains visible in Actions even when no PNG is opened.
    console.log(`HKS_NATURAL_TRIAL ${JSON.stringify(summary)}`);
  }
  if (failure) throw failure;
}

// Ordinary playtrial remains exactly one natural life. Deepplay uses three
// independently launched serial lives and predetermined radii. Serial mode
// skips later lives on timeout or error; a running life is never reset.
test('Hks natural survival: real controls, bounded one-attempt evidence @survival',async({page},info)=>{
  test.skip(process.env.RUN_HKS_SURVIVAL !== '1' || process.env.RUN_HKS_DEEPPLAY === '1','Opt in to the single natural trial');
  await runNaturalTrial(page,info,240);
});
test.describe.serial('Hks bounded natural deepplay',()=>{
  test.describe.configure({ retries: 0 });
  test.skip(process.env.RUN_HKS_DEEPPLAY !== '1','Opt in to at most three serial natural lives');
  for (const radius of [240,190,220]) test(`natural life: ${radius}px orbit @deepplay`,async({page},info)=>{
    await runNaturalTrial(page,info,radius);
  });
});
