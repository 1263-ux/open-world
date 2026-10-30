import { expect, test, type Page } from '@playwright/test';
import { campuses } from '../../src/campus-data/campuses';
import { position } from './campus-walk';

declare global { interface Window { __testFocusEvents: string[] } }
// Headless Chromium did not emit a window blur in CI. This scenario must use
// a real headed window; never synthesize blur or treat a skip as a pass.
// Playwright 1.64.1 coreBundle.js enables focus emulation on each main frame.
// Disable that framework override via the documented experimental CDP command
// after navigation; actual tab activation below must then produce a real blur.
// https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Emulation.pdl
// https://playwright.dev/docs/api/class-cdpsession (accessed 2026-10-30).
// Linux CI: RUN_HEADED_FOCUS=1 xvfb-run -a npx playwright test tests/e2e/focus.spec.ts --headed
// Playwright CI guidance: https://playwright.dev/docs/ci#running-headed (2026-10-30).
test.skip(process.env.RUN_HEADED_FOCUS !== '1', 'Requires a real headed window under Xvfb; run the dedicated focus job');
test.use({ headless: false });

test('window blur clears held movement when keyup is missed', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    window.__testFocusEvents = [];
    window.addEventListener('blur', () => window.__testFocusEvents.push('blur'));
    window.addEventListener('focus', () => window.__testFocusEvents.push('focus'));
  });
  await page.goto('/');
  const focusSession = await page.context().newCDPSession(page);
  await focusSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.bringToFront(); await expect.poll(() => page.evaluate(() => document.hasFocus()), { timeout: 10000 }).toBe(true);
  await page.getByTestId('campus-huyu').click();
  const canvas = page.getByTestId('campus-canvas');
  await expect.poll(async () => {
    const x=await canvas.getAttribute('data-player-x'),z=await canvas.getAttribute('data-player-z');
    return x===null||z===null?Infinity:Math.hypot(Number(x)-campuses.huyu.start[0],Number(z)-campuses.huyu.start[1]);
  }, { timeout: 15000 }).toBeLessThan(1);
  const frame = async () => Number(await canvas.getAttribute('data-frame'));
  const advance = async (from: number, count: number) => {
    await expect.poll(frame, { timeout: 15000, intervals: [100] }).toBeGreaterThanOrEqual(from + count);
  };
  await canvas.focus(); const initial = await position(canvas);
  await page.keyboard.down('w');
  let other: Page | undefined;
  try {
    await expect.poll(async () => { const p=await position(canvas);return Math.hypot(p[0]-initial[0],p[2]-initial[2]); }, {timeout:15000}).toBeGreaterThan(.5);
    const priorBlurCount = await page.evaluate(() => window.__testFocusEvents.filter(x => x === 'blur').length);
    other = await page.context().newPage(); await other.goto('about:blank');
    const otherFocusSession = await page.context().newCDPSession(other);
    await otherFocusSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => !document.hasFocus()), { timeout: 10000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__testFocusEvents.filter(x => x === 'blur').length), { timeout: 10000 }).toBeGreaterThan(priorBlurCount);
    await page.bringToFront(); await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    await advance(await frame(),1);
    const restored = await position(canvas); await advance(await frame(),2); const after = await position(canvas);
    expect(Math.hypot(after[0]-restored[0],after[2]-restored[2]), 'Actual window blur must clear W without a keyup').toBeLessThan(.25);
  } finally {
    await page.keyboard.up('w'); if (other) await other.close();
    const events = await page.evaluate(() => window.__testFocusEvents).catch(() => []);
    await info.attach('real-window-focus-events', { body: JSON.stringify({ events, frameworkFocusEmulation: 'disabled via CDP after navigation; no synthetic blur events' }), contentType: 'application/json' });
    await focusSession.detach().catch(() => undefined);
  }
});
