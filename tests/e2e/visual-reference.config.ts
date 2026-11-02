import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import campusConfig from '../../playwright.config';

// This suite compares two explicitly supplied, separately built static sites.
// It must never start the default development server or silently use one build
// for both sides. The spec validates its required URLs before any navigation.
export default defineConfig({
  ...campusConfig,
  testDir: '.',
  testMatch: 'campus-visual-reference.spec.ts',
  webServer: undefined,
  use: { ...campusConfig.use, baseURL: undefined },
  reporter: [['list'], ['html', { open: 'never', outputFolder: resolve('visual-reference-report') }]],
});
