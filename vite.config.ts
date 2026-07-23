import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '오구서바이벌: 모듈러 아레나',
        short_name: '오구서바이벌',
        description: '15분 데이터 중심 서바이버라이크 프로토타입',
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
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  build: { target: 'es2022', sourcemap: true }
});
