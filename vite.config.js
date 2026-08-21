import { defineConfig } from "vite";

export default defineConfig({
  base: "/nigel-mary-wedding/",
  appType: "mpa",
  publicDir: "public",
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 8123,
    strictPort: true,
    open: false,
    watch: {
      ignored: [
        "**/.agents/**",
        "**/.cursor/**",
        "**/.interface-design/**",
        "**/node_modules/**",
        "**/scripts/**",
      ],
    },
  },
});
