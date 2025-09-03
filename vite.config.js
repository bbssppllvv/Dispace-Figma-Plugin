import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import postcssConfig from './postcss.config.js'; // Import PostCSS config

export default defineConfig({
  root: "src/ui",          // where our HTML lives
  plugins: [viteSingleFile()], // Reverted: Add the plugin without extra options
  css: { // Explicitly define PostCSS config
    postcss: postcssConfig
  },
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/ui/index.html"
    }
  }
}); 