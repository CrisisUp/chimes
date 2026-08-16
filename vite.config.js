import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'src/assets'),
  build: {
    outDir: resolve(__dirname, 'public'),
    emptyOutDir: true,
    minify: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        stage: resolve(__dirname, 'src/02-strings.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) return 'style.css';
          if (assetInfo.name.endsWith('.webp')) return 'assets/[name][extname]';
          if (assetInfo.name.endsWith('.svg')) return 'assets/[name][extname]';
          return 'assets/[name][extname]';
        }
      }
    }
  },
  server: {
    port: 8000,
    open: '/index.html'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  }
});