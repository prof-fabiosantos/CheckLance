import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API requests during local development to serverless functions if needed
    // process.env.VERCEL_URL handles this automatically in production
  }
});