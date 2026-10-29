import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [
    cloudflare(),
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
    watch: {
      ignored: [
        '**/.wrangler/**',
        '**/.git/**',
        '**/node_modules/**',
        '**/migrations/**',
        '**/tests/**',
      ],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'tldraw'],
  },
});
