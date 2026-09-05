import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pinned so `npm run dev` matches the port the tools/ harness defaults to.
  // Without this vite picks whatever is free, and the screenshot and soak
  // scripts quietly point at nothing.
  server: { port: 5178, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
