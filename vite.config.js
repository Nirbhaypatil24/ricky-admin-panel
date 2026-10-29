import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost', // Changed from '10.131.6.124' to 'localhost'
    port: 5173,
    open: true, // Automatically open browser
  },
  define: {
    global: 'window'
  }
})
