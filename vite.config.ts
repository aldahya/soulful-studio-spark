import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // هذا الجزء يضمن أن الملفات في مجلد public تذهب للمكان الصحيح
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
