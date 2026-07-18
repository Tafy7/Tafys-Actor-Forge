import { defineConfig } from 'vite';

export default defineConfig({
  // base './' = percorsi relativi nella build: fondamentale per GitHub Pages,
  // dove l'app non vive alla radice del dominio ma in /nome-repo/
  base: './',
});
