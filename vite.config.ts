import { defineConfig } from 'vite';

// GitHub Pages serves the site from /tank-game/, so production builds use that base path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tank-game/' : '/',
}));
