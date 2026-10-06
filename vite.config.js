import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import blogApi from './server/blogApi.js'

export default defineConfig({
  plugins: [react(), blogApi()],
  server: {
    host: 'localhost',
    watch: {
      // OneDrive 폴더에서도 변경 감지가 안정적으로 동작하도록 polling 사용
      usePolling: true,
      interval: 300,
      // 글/이미지/인증 데이터 저장이 새로고침을 유발하지 않도록 제외
      ignored: ['**/content/**', '**/data/**'],
    },
  },
})
