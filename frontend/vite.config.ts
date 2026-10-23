import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중에는 /api 를 백엔드(127.0.0.1:8000)로 넘긴다. 빌드 결과는 백엔드가 같은 주소에서 준다.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
  build: { outDir: "dist" },
});
