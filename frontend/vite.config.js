import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/grader/cs116.q21/WEB_CS116/",
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:11621",
        changeOrigin: true,
      },
    },
  },
});
