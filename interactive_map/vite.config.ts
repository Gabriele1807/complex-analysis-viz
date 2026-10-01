import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Percorsi relativi: la cartella `dist/` si può aprire da file system,
  // servire da una sottocartella qualunque o pubblicare su un hosting statico
  // senza dover riconfigurare nulla.
  base: "./",
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          // Plotly è grande e serve solo nei pannelli 3D: tenerlo in un chunk
          // separato permette di caricarlo solo quando si apre quel pannello.
          plotly: ["plotly.js-dist-min"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
