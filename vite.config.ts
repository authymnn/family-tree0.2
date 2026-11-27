import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base path so builds work seamlessly on GitHub Pages, Vercel, Netlify, or local preview
  base: './',
  plugins: [react(), tailwindcss()],
});
