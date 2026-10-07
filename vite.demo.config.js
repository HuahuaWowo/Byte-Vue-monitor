import { defineConfig } from "vite";
import { createCollector } from "./example/collector.js";
export default defineConfig({
  root: "example",
  define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: [{ name: "local-collector", configureServer(server) { server.middlewares.use(createCollector()); } }],
  build: { outDir: "../demo-dist", emptyOutDir: true },
});
