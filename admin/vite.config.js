import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The admin app runs on its own port so it never collides with the main
// frontend during local dev. It talks to the same backend as the frontend,
// configured through VITE_BACKEND_URL (see src/lib/config.js).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
