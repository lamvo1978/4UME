import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the API runs on :5088; proxying keeps requests same-origin like in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": "http://localhost:5088", "/media": "http://localhost:5088" },
  },
});
