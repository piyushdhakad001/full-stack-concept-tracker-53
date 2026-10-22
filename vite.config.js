import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev only: forward /api calls to the Express server
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:5000" } },
});
