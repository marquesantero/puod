import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5001"
  const integrationTarget = env.VITE_INTEGRATION_PROXY_TARGET || "http://localhost:5002"
  const studioTarget = env.VITE_STUDIO_PROXY_TARGET || "http://localhost:5005"

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        // Studio Service endpoints (versioned) - must be before general /api rule
        "/api/v1/studio": {
          target: studioTarget,
          changeOrigin: true,
        },
        // Integration Service endpoints (versioned) - must be before general /api rule
        "/api/v1/integration": {
          target: integrationTarget,
          changeOrigin: true,
        },
        // User Service and all other versioned endpoints
        "/api/v1": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
