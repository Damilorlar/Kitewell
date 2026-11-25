import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const bufferPath = path.dirname(require.resolve("buffer/"));

export default defineConfig({
  base: '/kitewell/',
  plugins: [react()],
  resolve: {
    alias: {
      buffer: bufferPath,
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
