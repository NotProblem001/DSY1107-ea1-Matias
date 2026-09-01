import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // El puerto NO es negociable: http://localhost:5173/ es el callback_url
    // registrado en Cognito. strictPort evita que Vite salte al 5174 si el
    // 5173 está ocupado, porque entonces el redirect_uri dejaría de coincidir.
    port: 5173,
    strictPort: true,
  },
})
