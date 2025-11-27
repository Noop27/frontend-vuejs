import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import vueDevTools from 'vite-plugin-vue-devtools' 

// Helper function to resolve paths reliably
const __dirname = path.resolve();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  css: {
    // Explicitly set the PostCSS configuration file path.
    // This forces Vite to load the newly renamed .cjs file,
    // bypassing potential path resolution bugs.
    postcss: path.resolve(__dirname, 'postcss.config.cjs')
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})