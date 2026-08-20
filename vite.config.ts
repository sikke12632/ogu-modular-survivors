import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '오구서바이벌: 모듈러 아레나',
        short_name: '오구서바이벌',
        description: '5분 또는 10분 동안 학교를 지키는 빠른 서바이버라이크',
        theme_color: '#07111f',
        background_color: '#07111f',
        display: 'standalone',
        orientation: 'landscape',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  build: { target: 'es2022', sourcemap: true }
});
