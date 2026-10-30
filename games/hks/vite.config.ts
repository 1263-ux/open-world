import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { target: 'es2020', outDir: '../../public/games/hks', emptyOutDir: true } });
