import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, "api/cert/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, "api/cert/cert.pem")),
    },
    proxy: {
      "/api": {
        target: "http://192.168.0.128:3001",
        changeOrigin: true,
        secure: false, // ignore SSL for self-signed certs
      },
    },
  },
});
