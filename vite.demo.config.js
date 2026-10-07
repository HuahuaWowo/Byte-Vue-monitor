import { defineConfig } from "vite";
import { createCollector } from "./example/collector.js";
export default defineConfig({
  root: "example",
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: [{ name: "local-collector", configureServer(server) { server.middlewares.use(createCollector()); } }],
  build: { outDir: "../demo-dist", emptyOutDir: true },
});
