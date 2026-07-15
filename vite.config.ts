import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "classbud-icon.svg",
        "classbud-maskable.svg",
        "classbud-192.png",
        "classbud-512.png",
        "classbud-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "ClassBud",
        short_name: "ClassBud",
        description: "Offline-first M.5 schedule, tasks, notes, and Buddy assistant.",
        start_url: "/today",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#0A0A0B",
        categories: ["education", "productivity"],
        icons: [
          { src: "/classbud-192.png", sizes: "192x192", type: "image/png" },
          { src: "/classbud-512.png", sizes: "512x512", type: "image/png" },
          { src: "/classbud-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/classbud-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          { src: "/classbud-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,txt}"],
        runtimeCaching: []
      }
    })
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    css: true,
    coverage: { reporter: ["text", "html"] }
  }
});
