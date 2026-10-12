import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      'lumber-deviant-oasis.ngrok-free.dev',
      '.ngrok-free.dev',
      '.ngrok-free.app',
    ],
    host: true,
  },
})