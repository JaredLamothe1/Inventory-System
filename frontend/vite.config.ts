import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';  // Import the tailwindcss plugin
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),  // Add the tailwindcss plugin here
  ],
  resolve:{
  alias: {
      '@': path.resolve(__dirname, './src'),
    },
  }
});
