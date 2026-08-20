import { defineConfig } from "vite";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

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
    headers: noCache,
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
  preview: {
    headers: noCache,
  },
});
