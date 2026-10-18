import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

// Relative base so the build works at any sub-path (GitHub Pages project site, Cloudflare Pages root).
export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
