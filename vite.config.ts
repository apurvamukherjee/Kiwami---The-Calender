import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered explicitly via useRegisterSW() in App.tsx instead of the
      // auto-injected script, so the app can surface `needRefresh` as a real
      // "update available" banner rather than swapping silently.
      injectRegister: false,
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Kiwami",
        short_name: "Kiwami",
        description: "Calendar, routines, and food-time tracking — offline-first.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        background_color: "#0a0a0d",
        theme_color: "#0a0a0d",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Dexie is the source of truth and needs no caching; this just makes
        // the app shell + static assets available with zero network. woff/
        // woff2 were missing here — a real bug found during the Life tab's
        // offline verification pass: the self-hosted @fontsource fonts
        // (index.css) were never actually precached, so a font weight/format
        // the browser's own HTTP cache hadn't happened to retain yet would
        // 404 on a genuine offline reload, contradicting CLAUDE.md's "static
        // woff2 only... offline-first guarantee still holds" claim for
        // those fonts.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith("convex.cloud"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
  build: {
    target: ["es2019", "safari14", "chrome80", "firefox78", "edge88"],
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          antd: ["antd"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
